import * as CSS from 'csstype';
import { RegisteredStyle } from './styling';
import { AnimationDefinition, FontFaceDefinition, KeyFrames, Rules, Styles } from "./types";
import { defaultUnit, defaultUnitAndValue, defaultValue } from "./utils";

export function css(rules: Rules) {
    return ruleSet('', Object.entries(rules))
        .join('\n');
}

export function fontFaceCss(fontFace: FontFaceDefinition) {
    return `@font-face { ${cssProperties(Object.entries(fontFace))} }`;
}

export function keyframesCss(name: string, keyframes: KeyFrames) {
    return `@keyframes ${name} {\n${
        Object.entries(keyframes)
            .map(([offset, styles]) => `  ${baseRule(defaultUnit('%', true)(offset), Object.entries(styles!))}`)
            .join('\n')
        }\n}`;
}

function ruleSet(parentSelector: string, rules: [string, Styles][]): string[] {
    return rules
        .map(([selector, styles]) =>
            selector.startsWith('@media') || selector.startsWith('@supports') ? styleRules(parentSelector, styles).map(rule => `${selector} { ${rule} }`)
                : selector.includes('&') ? styleRules(selector.replace(/&/g, parentSelector), styles)
                    : parentSelector ? styleRules(`${parentSelector} ${selector}`, styles)
                        : styleRules(selector, styles))
        .reduce((a, b) => a.concat(b), []);
}

function styleRules(selector: string, styles: Styles) {
    let { properties, nested, keyframes } = splitProperties(styles, selector);

    return baseRule(selector, properties)
        .concat(ruleSet(selector, nested))
        .concat(keyframes.map(kfs => keyframesCss(...kfs)));
}

export function splitProperties(styles: Styles, selector: string = 'inline') {
    let properties = [] as [string, any][];
    let nested = [] as [string, Styles][];
    let keyframes = [] as [string, KeyFrames][];

    Object.entries(styles)
        .forEach(([key, value]) => {
            if (key == '$')
                nested = nested.concat(Object.entries(value));
            else if (key[0] == ':')
                nested.push([`&${key}`, value]);
            else if (key == 'animation') {
                let animation = animationValues(value, selector);
                properties.push([key, animation.value]);
                keyframes = keyframes.concat(animation.keyframes);
            } else
                properties.push([key, value]);
        });

    return { properties, nested, keyframes };
}

function animationValues(value: CSS.AnimationProperty | AnimationDefinition, selector: string) {
    return Array.isArray(value)
        ? value.map((v, i) => singleAnimation(v, selector, i))
            .reduce((a, b) => ({ value: `${a.value}, ${b.value}`, keyframes: a.keyframes.concat(b.keyframes) }))
        : singleAnimation(value, selector);
}

function singleAnimation(animation: CSS.AnimationProperty | AnimationDefinition, selector: string, index = 0): { value: string, keyframes: [string, KeyFrames][] } {
    if (typeof animation == 'object') {
        if (!animation.keyframes || RegisteredStyle in animation.keyframes)
            return { value: animationFromDefinition(animation), keyframes: [] };

        let animationName = inlineAnimationName(animation.animationName, selector, index);
        return { value: animationFromDefinition({ ...animation, animationName }), keyframes: [[animationName, animation.keyframes]] };
    }
    return { value: animation as string, keyframes: [] };
}

function animationFromDefinition(def: AnimationDefinition) {
    return ['animationName',
        'animationDuration',
        'animationTimingFunction',
        'animationDelay',
        'animationIterationCount',
        'animationDirection',
        'animationFillMode',
        'animationPlayState']
        .map(prop => cssPropertyValue(prop, def[prop as keyof AnimationDefinition]))
        .join(' ');
}

function inlineAnimationName(name: unknown, selector: string, index: number) {
    return String(name || (selector + '-animation')).replace(/[^\w\d-_]+/g, '_').replace(/^_/, '') + `-${index}`;
}

function baseRule(selector: string, styles: [string, any][]) {
    return styles.length
        ? [`${selector} { ${cssProperties(styles)} }`]
        : [];
}

export function cssProperties(styles: [string, any][]) {
    return styles
        .filter(([, value]) => typeof value != 'undefined')
        .map(([property, value]) => `${kebabCase(property)}: ${cssPropertyValue(property, value)};`)
        .join(' ');
}

export function cssPropertyValue(property: string, value: any): string | undefined {
    return Array.isArray(value) ? value.map(v => cssPropertyValue(property, v)).join(spaceSeparatedValueProperties.includes(property) ? ' ' : ', ')
        : typeof value == 'object' ? cssFunctions(property, value)
            : (propertyDefaults[property as keyof CSS.Properties] || defaultUnit('px'))(value);
}

function cssFunctions(property: string, functionMap: object) {
    return Object.entries(functionMap)
        .map(([fn, value]) => `${functionKebabCase(fn)}(${cssFunctionValue(property, fn, value)})`)
        .join(' ');
}

function cssFunctionValue(property: string, fn: string, value: any): string {
    if (Array.isArray(value))
        return value.map(v => cssFunctionValue(property, fn, v)).join(', ');
    return fn in functionDefaults
        ? functionDefaults[fn](value)
        : cssPropertyValue(property, value)!;
}

function kebabCase(name: string) {
    return name.replace(/[A-Z]/g, capital => `-${capital.toLowerCase()}`);
}

function functionKebabCase(name: string) {
    return name.replace(/[A-Z](?!$)/g, capital => `-${capital.toLowerCase()}`);
}

export const propertyDefaults: { [property in keyof CSS.Properties]?: (value: any) => string } = {
    animationDuration: defaultUnitAndValue('ms', '0ms'),
    animationTimingFunction: defaultValue('ease'),
    animationDelay: defaultUnitAndValue('ms', '0ms'),
    animationIterationCount: defaultUnitAndValue('', '1'),
    animationDirection: defaultValue('normal'),
    animationFillMode: defaultValue('none'),
    animationPlayState: defaultValue('running'),
    columnCount: defaultUnit(''),
    flex: defaultUnit(''),
    flexGrow: defaultUnit(''),
    flexShrink: defaultUnit(''),
    fontWeight: defaultUnit(''),
    lineHeight: defaultUnit(''),
    opacity: defaultUnit(''),
    transitionDuration: defaultUnit('ms'),
    transitionDelay: defaultUnit('ms'),
    zIndex: defaultUnit('')
};

export const functionDefaults: { [cssFunction: string]: (value: any) => string } = {
    matrix: defaultUnit(''),
    matrix3d: defaultUnit(''),
    rotate: defaultUnit('deg'),
    rotateX: defaultUnit('deg'),
    rotateY: defaultUnit('deg'),
    rotateZ: defaultUnit('deg'),
    rotate3d: defaultUnit(''),
    scale: defaultUnit(''),
    scaleX: defaultUnit(''),
    scaleY: defaultUnit(''),
    scaleZ: defaultUnit(''),
    scale3d: defaultUnit(''),
    skew: defaultUnit('deg'),
    skewX: defaultUnit('deg'),
    skewY: defaultUnit('deg')
};

export const spaceSeparatedValueProperties = [
    'borderColor',
    'borderRadius',
    'borderStyle',
    'borderWidth',
    'margin',
    'padding',
    'transform'
];
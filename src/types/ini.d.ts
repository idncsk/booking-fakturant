declare module 'ini' {
    export function parse(str: string): any;
    export function stringify(obj: any, options?: any): string;
    export function safe(str: string): any;
    export function encode(obj: any, options?: any): string;
    export function decode(str: string): any;
    export function isini(obj: any): boolean;
}
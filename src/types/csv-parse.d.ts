declare module 'csv-parse' {
  import { Parser } from 'csv-parse/sync';
  export { Parser };
  export function parse(input: Buffer | string, options?: any): any[][];
}
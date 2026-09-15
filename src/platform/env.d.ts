declare const __APP_VERSION__: string;
declare const __MOBILE__: boolean;

declare module "sql.js/dist/sql-wasm.wasm?url" {
  const url: string;
  export default url;
}

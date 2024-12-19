import { readFile, writeFile, mkdir, access, constants } from "fs/promises";
import { dirname } from "path";

export class ArrayIO<T> {

  private filePath: string
  private _data: Array<T>

  constructor(filePath: string) {
    this.filePath = filePath;
    this._data = [];
    this.initialize();
  }

  private async initialize() {
    await this.initializeDirectory();

    try { await access(this.filePath, constants.R_OK); }
    catch {
      console.log("No file, creating new one...", this.filePath);
      await writeFile(this.filePath, JSON.stringify([]));
    }

    await this.read();
  }

  private async initializeDirectory() {
    const dir = dirname(this.filePath);
    try { await access(dir, constants.R_OK); }
    catch {
      console.log("No directory, creating new one...", dir);
      await mkdir(dir, { recursive: true });
    }
  }

  async read() {
    let reportsString = "";
    reportsString = String(await readFile(this.filePath));
    this._data = JSON.parse(reportsString);
    return this._data;
  }

  async write() {
    await this.initializeDirectory();
    await writeFile(this.filePath, JSON.stringify(this._data));
  }

  async push(v: T) {
    await this.read();
    this._data.push(v);
    await this.write();
  }

  get data() { return this._data; }
  set data(v: T[]) { this._data = v; }
}

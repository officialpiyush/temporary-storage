import { EventEmitter } from "events";
import { Endb } from "endb";
import { writeFile, pathExists, unlink } from "fs-nextra";
import * as schedule from "node-schedule";

declare interface TemporaryStorage {
    on(event: string, listener: () => void): this;
};

class TemporaryStorage extends EventEmitter {
    private _path: string;
    private _db: Endb<any>;
    public ready: boolean;
    public time: number;

    constructor(options: IOptions = {}) {
        super();

        this.ready = false;
        this._path = options.path || "sqlite://db/tempstorage.sqlite";
        this._db = new Endb({uri: this._path, namespace: "storage"});
        this.time = options.time || 1200;
        this._init();
    };

    private async _init() {
        const all = await this._db.all();

        for(let i=0;i<all!.length; i++) {
            await this._schedule(all![i].value.name, all![i].value.path, all![i].value.time, true);
        };

        this.ready = true;
    };

    public async add(name: string, data: any) {
        if(!this.ready) {
            throw "TemporaryStorage: Module not ready";
        }
        const time = new Date().getTime()
        const path = `./temp/${name}-${time}`;

        await writeFile(path, data);
        await this._schedule(`${name}-${time}`, path, (new Date().getTime()) + 1200, false )
        return true;
    };

    private async _schedule(name: string, path: string, time: number, isFromDB: boolean = false) {
        if(time < new Date().getTime()) {
            this.emit("overtime");
            const isPresent = await pathExists(path);
            if(isPresent) {
                await unlink(path);
            };

            return;
        };

        if(!isFromDB) {
            await this._db.set(name, {
                path,
                time,
                name
            });
        };

        await schedule.scheduleJob(new Date(time * 1000), async () => {
            await unlink(path);
            await this._db.delete(name);
        });
    };
};

interface IOptions {
    path?: string
    time?: number
}

export = TemporaryStorage;

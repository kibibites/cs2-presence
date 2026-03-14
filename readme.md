# cs2 presence

discord rich presence for counter strike 2.

## preview

![preview image](./preview.png)

## download

| platform    | link                                                                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **windows** | [latest](https://github.com/kibibites/cs2-presence/releases/download/1.1.3/cs2-presence.exe.xz) \| [nightly](https://nightly.link/kibibites/cs2-presence/workflows/deno/mistress/windows.zip) |
| **linux**   | [latest](https://github.com/kibibites/cs2-presence/releases/download/1.1.3/cs2-presence.xz) \| [nightly](https://nightly.link/kibibites/cs2-presence/workflows/deno/mistress/linux.zip)       |

## usage

1. download either the executable from the section above.

2. extract and run the executable, and start your game.

    - **note**: you must start the program _before_ you launch the game for the first time; then, the order of you starting does not matter anymore.

3. visit [`http://localhost:8000`](http://localhost:8000) to change preferences.

## api

this server only handles POST requests from cs2, it does not have any other http apis. all client-server communications are over websockets at `ws://localhost:8000/ws`.

### heartbeat

```typescript
const ping = new Uint8Array([0xe2, 0x99, 0xa1]);
const pong = new Uint8Array([0xe2, 0x99, 0xa5]);
```

after client connects to the server, it must send _pings_ at least every 3-4 seconds to avoid time out.

the server will reply with _pong_.

### sync

```typescript
export interface Activity {
  details: string;
  state?: string;
  assets: {
    large_image: string;
    large_text: string;
  };
  timestamps: {
    start: number;
  };
}

const sync = new Uint8Array([0xe2, 0x87, 0x8b, ...encodeCbor(obj satisfies Activity)])
```

the server will send clients _sync_ messages, formatted like above, whenever there is an activity update.

### saving options

```typescript
interface Options {
  timeout: number;
  fluffy: boolean;
  disableFluffy: boolean;
}

const options = new Uint8Array([0xe2, 0x9a, 0x99, ...encodeCbor(obj satisfies Options)])
```

the clients can send the server _options_ messages to update the options.

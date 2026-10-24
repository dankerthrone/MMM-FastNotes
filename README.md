## MMM-FastNotes
Module for [MagicMirror](https://github.com/MichMich/MagicMirror). Can be used for adding notes on MagicMirror using fast and easy web interface

<details><summary><h3>Watch demonstration (click to expand)</h3></summary>

#### Magic Mirror screen
Little speed up for screenrecord
<details>
<p>
    <img src="/preview/preview.gif" width="768" height="1360" />
</p>
</details>

#### Web GUI powered by this module
<details>
<p>
    <img src="/preview/web_gui_1.jpg" width="295" height="640" />
    <img src="/preview/web_gui_2.jpg" width="295" height="640" />
    <img src="/preview/web_gui_3.jpg" width="295" height="640" />
    <img src="/preview/web_gui_4.jpg" width="295" height="640" />
</p>

"Notes" in browser`s addres link is just DNS name for raspberry in my home network. Actualy it is something like 192.168.1.1

</details>
</details>


### How to use
* Clone this module repo into `MagicMirror/modules`
* Run `./scripts/setup.sh` (installs Python venv + Node deps and verifies the sqlite3 binding)
* Add the module to your `config.js`
* Restart the mirror
* Open `http://<MIRROR_IP>:5000` or `http://<hostname>.local:5000` and enjoy

### Dependencies

* [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror) (v2.16.0 or higher)
* [Node.js](https://nodejs.org/) (v20 or higher) & npm
* Python 3.8 or higher
* Node packages (installed automatically into this module folder): [python-shell](https://www.npmjs.com/package/python-shell), [sqlite3](https://www.npmjs.com/package/sqlite3), [qr-code-styling](https://www.npmjs.com/package/qr-code-styling)

### Installation

Navigate into your MagicMirror's modules folder:

```bash
cd ~/MagicMirror/modules
```

Clone this module repository:
```markdown
git clone https://github.com/dankerthrone/MMM-FastNotes.git
cd MMM-FastNotes
```

Run the setup script. It creates the Python virtualenv, installs the Python
**and** Node dependencies, and verifies that the `sqlite3` native binding
actually loads (a silently missing binding is the classic reason this module
shows no notes):

```bash
./scripts/setup.sh
```

Want the web UI browsable as `http://<hostname>.local:5000` via DNS-SD/Avahi?
Run it once with root so it can install the service definition:

```bash
sudo ./scripts/setup.sh
```

<details>
<summary>Manual installation (instead of the script)</summary>

Install the Node dependencies. This must be a plain `npm install` **inside the
module folder** - it picks up the versions from `package.json`:

```bash
npm install
```

> **Why this matters:** `sqlite3` ships a native binding. Modern npm (>= 11)
> only runs install scripts that are allow-listed, so this module's
> `package.json` declares `allowScripts` for `sqlite3`. Without that, npm skips
> the build silently and the mirror ends up with no notes. Verify with:
>
> ```bash
> npm run check:sqlite     # should print: sqlite3 binding OK
> ```
>
> If it fails, `npm rebuild sqlite3` and re-check. You may be missing build
> tools (Debian/Raspberry Pi OS: `sudo apt install build-essential python3`,
> Arch: `sudo pacman -S base-devel python`).

Create the Python virtualenv and install the requirements:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

The `node_helper` auto-detects `.venv/bin/python3`, so no extra configuration
is needed. (Set `pythonPath` in `config.js` only if you want to override that.)

</details>

If Python 3 is missing, install it via your package manager:

*    Arch / CachyOS / Manjaro: sudo pacman -S python
*    Debian / Ubuntu / Raspberry Pi OS: sudo apt install python3
*    macOS: brew install python3
*    Windows: python.org (add to PATH during install)


### Network & security

By default the web UI listens on `0.0.0.0` (all interfaces), so any device on
your LAN can open it:

* `http://<MIRROR_IP>:5000`
* `http://<hostname>.local:5000` (needs a running `avahi-daemon` / mDNS)

With `host: "0.0.0.0"` the module actually binds a dual-stack socket (`::`),
so the UI answers on IPv4 **and** IPv6. That matters because mDNS may resolve
`<hostname>.local` to either address family depending on the client - an
IPv4-only bind would be unreachable for every client that got the AAAA record.

**If you have an active firewall on your MagicMirror, you need to open port 5000 in order for this module to work.** Do this by 

```
sudo ufw allow 5000/tcp comment 'MMM-FastNotes WebUI'
```


**The form has no authentication.** Anyone on the same network can create,
edit and delete notes. On a trusted home LAN that is usually fine, but be aware
of it if your mirror is reachable beyond your LAN (port forwarding to the
internet, or a Tailscale/WireGuard network with other members). To lock the UI
to the mirror itself, set `host: "127.0.0.1"` in `config.js`.


### Configuration
Here is example of config, that must be placed in *config.js* file in array *modules*
```markdown
{
module: 'MMM-FastNotes', //module name
disabled: false,         //false if you want turn on module
position: 'top_left',
config: {
    host: "0.0.0.0",     // listen on all interfaces -> reachable via http://<MIRROR_IP>:5000 and http://<hostname>.local:5000. Use "127.0.0.1" to lock it to the mirror.
    port: 5000,          // port on host where UI will be accessible via web browser
    css: 0,               // 0 - current default MM CSS styles; 1 - custom css stile
    // TextStyle could be "xsmall bright" or "medium bright" or another one defined in /home/pi/MagicMirror/css/main.css, or in your own custom CSS
    nameTextStyle: "xsmall bright", // style for Note Name
    contentTextStyle: "normal dimmed", // style for Note Content
    coloredNotes: false,   // true: every note gets its own text color (Miyazaki-16 palette)
    QRCode: false,         // true: show a QR code above the notes that points to the web UI
    qrCodeSize: 120        // QR code size in pixels
  }
},
```

| Option | Default | Description |
| --- | --- | --- |
| `host` | `"0.0.0.0"` | Interface the web UI binds to. `0.0.0.0` = reachable from any LAN device; `127.0.0.1` = mirror only. |
| `port` | `5000` | Port of the web UI. |
| `pythonPath` | `null` (auto) | Python binary for the backend. Auto-detects `.venv/bin/python3`, then `python3`. |
| `updateInterval` | `5000` | How often (ms) the mirror re-reads the notes database. |
| `css` | `0` | `0` = default module CSS, `1` = `css/custom.css`. |
| `nameTextStyle` / `contentTextStyle` | `"xsmall bright"` / `"normal dimmed"` | MagicMirror text classes for note title / body. |
| `animationSpeed` | `2500` | Fade duration (ms) when notes change. |
| `coloredNotes` | `false` | `true` gives every note its own text color from the [Miyazaki-16 palette](https://lospec.com/palette-list/miyazaki-16) (by skeddles), minus its three darkest colors. The color is derived from the note title, so a note keeps its color when other notes are added or deleted. |
| `QRCode` | `false` | `true` shows a small rounded QR code above the notes. It encodes `http://<MIRROR_IP>:<port>` (plain IPv4, not `.local` - mDNS is unreliable across phone OSes), so scanning it with a phone opens the web UI. |
| `qrCodeSize` | `120` | Width/height of the QR code in pixels. |

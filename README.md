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
* Clone this module repo
* Install dependencies and requirements
* Add module to config file
* Restart Mirror to apply config
* Open **host:port** provided in config.js and enjoy

### Dependencies
* [MagicMirror](https://github.com/MichMich/MagicMirror)
* [python-shell](https://www.npmjs.com/package/python-shell)
* [sqlite3](http://npmjs.com/package/sqlite3)
* Python 3.6 or higher

### Installation
Navigate into your MagicMirror's modules folder
```markdown
cd ~/MagicMirror/modules
```

Clone this module repository:
```markdown
git clone https://github.com/polarbearjngl/MMM-FastNotes.git
```

Navigate to the new MMM-FastNotes folder and install the npm **python-shell** dependency
```markdown
npm install python-shell
npm install sqlite3
```

Check that you have installed **Python 3.6 or higher** on your Raspberry. Just write in console `python3`, and if it exists, you will see python terminal. If not, you need to install it with this line
```markdown
sudo apt-get install python3
```

Then install required packages from requirements.txt
```markdown
sudo python3 -m pip install -r requirements.txt
```

### How the web UI is served

The Flask web UI is started by the MagicMirror `node_helper` itself. No extra
daemon, pm2 entry or systemd service is installed by this module.

* Before spawning the process the module checks whether something is already
  listening on `host:port`. If it is, it logs
  `Web UI is already served ... skipping own start.` and leaves the running
  instance alone — the UI stays reachable instead of dying on
  `Address already in use`.
* On every MagicMirror shutdown/restart the helper stops its Flask process
  again (`Stopping web UI process ...`), so it cannot outlive the mirror and
  block the port on the next start.

> **Coming from a version that installed the UI as a pm2 service?** Remove the
> leftover entry once, otherwise it keeps fighting over the port:
> ```
> pm2 delete fastnotes && pm2 save
> ```

### Optional: open the UI as `http://notes.local:5000`

Publishing an mDNS name means writing to `/etc/avahi/hosts` and
`/etc/avahi/services/`, so it needs root — `npm install` runs as your normal
user and cannot do it silently. The setup script therefore does it for you as
soon as it can get root:

```bash
cd ~/MagicMirror/modules/MMM-FastNotes
sudo ./scripts/setup.sh
```

What that does (all of it is idempotent, safe to run again at any time):

1. Installs `scripts/notes.service` → `/etc/avahi/services/notes.service`
   (announces the `_http._tcp` service on port 5000).
2. Installs `scripts/avahi-notes-dispatcher` →
   `/etc/NetworkManager/dispatcher.d/50-avahi-notes`.
3. Runs that dispatcher once, which writes
   `<current-ip> notes.local` into `/etc/avahi/hosts` and restarts
   `avahi-daemon` (a SIGHUP is not enough — avahi only reloads service files
   then, not host aliases).

The dispatcher also runs automatically whenever NetworkManager gets or renews
an address, so **the name follows DHCP changes on its own** — no static IP
needed. Verify it with:

```bash
getent ahosts notes.local        # → your current IP
curl -I http://notes.local:5000/ # → HTTP/1.1 200 OK
```

**If you cannot or do not want to use sudo**, add the line manually instead
(replace the IP with your mirror's current address):

```bash
echo "192.168.178.36 notes.local" | sudo tee -a /etc/avahi/hosts
sudo systemctl restart avahi-daemon
```

Note: mDNS (`.local`) is resolved by Bonjour/mDNS-capable clients (Linux,
macOS, Windows with Bonjour, iOS). If a device on your network cannot open
`notes.local:5000`, either add the same line to that device's hosts file or
create a DNS name in your router — the fallback is always the plain IP.

### Configuration
Here is example of config, that must be placed in *config.js* file in array *modules*
```markdown
{
module: 'MMM-FastNotes', //module name
disabled: false,         //false if you want turn on module
position: 'top_left',
config: {
    host: "192.168.1.1",  // address of raspberry pi in local network, need for access to WEB UI
    port: 5000,           // port on host where UI will be accessible via web browser
    css: 0,               // 0 - current default MM CSS styles; 1 - custom css stile
    // TextStyle could be "xsmall bright" or "medium bright" or another one defined in /home/pi/MagicMirror/css/main.css, or in your own custom CSS
    nameTextStyle: "xsmall bright", // style for Note Name
    contentTextStyle: "normal dimmed" // style for Note Content
  }
},
```

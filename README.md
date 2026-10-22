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

### Choosing a name for the web UI

The web UI is reachable by IP straight away:

```
http://<mirror-ip>:5000
```

For a name you have exactly **one** usable option per address — there is no
config workaround around it:

* **System hostname (recommended).** Avahi publishes `$(hostname).local` for
  this machine's IP all by itself, it always matches the current address.
  Verify with `getent ahosts $(hostname).local`. Want another name? Change it
  once:

  ```bash
  sudo hostnamectl set-hostname notes      # -> http://notes.local:5000
  ```

  The name follows every DHCP change automatically, there is nothing to
  maintain. The DNS-SD service installed by the setup script follows the
  hostname as well, so `Notes on <hostname>` stays correct.

* **Do NOT add an alias via `/etc/avahi/hosts`.** Avahi owns one local name per
  address and rejects a second one, so such an alias never resolves and you get
  this on every avahi start instead:

  ```
  Static host name notes.local: avahi_server_add_address failure: Local name collision
  ```

  An earlier version of this setup script tried exactly that. Running it again
  removes the leftover entry from `/etc/avahi/hosts` plus the dispatcher script
  that used to rewrite it on every DHCP event, and installs the DNS-SD service
  without a hardcoded `<host-name>`:

  ```bash
  cd ~/MagicMirror/modules/MMM-FastNotes
  sudo ./scripts/setup.sh
  ```

**Checking from a client device:** open `http://<mirror-ip>:5000` first. If that
works but a `.local` name does not, the client does not do mDNS — common with
Android browsers and on Windows without Bonjour installed. Use the IP there, or
create a DNS name in your router. mDNS-capable clients (Linux, macOS, iOS,
Windows with Bonjour) resolve the system hostname without any extra step.


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

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

* [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror) (v2.16.0 or higher)
* [Node.js](https://nodejs.org/) (v16 or higher) & npm
* Python 3.8 or higher
* npm packages: [python-shell](https://www.npmjs.com/package/python-shell), [sqlite3](https://www.npmjs.com/package/sqlite3)

### Installation

Navigate into your MagicMirror's modules folder:

```bash
cd ~/MagicMirror/modules
```

Clone this module repository:
```markdown
git clone https://github.com/polarbearjngl/MMM-FastNotes.git
cd MMM-FastNotes
``` 

Install the required node.js **python-shell** and **sqlite** dependencies
```markdown
npm install python-shell sqlite3
```

#### Set up the Python environment:

Create a virtual environment (avoids conflict with system Python / PEP 668): 
```
python3 -m venv .venv
source .venv/bin/activate
```
If you don't use bash, look up how to source the venv with your specific shell. However, on a typical MM you shouldn't be using anything but bash ;) 

Install the Python requirements:

```
pip install -r requirements.txt 
```
    Important: If node_helper.js calls Python directly, update the path to use your virtual environment:

    // In node_helper.js, replace "python3" with:
    const pythonPath = __dirname + '/.venv/bin/python3';


Leave the venv with 
```
deactivate
```

Verify Python 3 (usually pre-installed):

```
python3 --version
```

If Python 3 is missing, install it via your package manager:

*    Arch / CachyOS / Manjaro: sudo pacman -S python
*    Debian / Ubuntu / Raspberry Pi OS: sudo apt install python3
*    macOS: brew install python3
*    Windows: python.org (add to PATH during install)


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

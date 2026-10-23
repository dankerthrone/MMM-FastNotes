Module.register("MMM-FastNotes", {
    defaults: {
        // "0.0.0.0" listens on every interface, so the web UI is reachable at
        // http://<MIRROR_IP>:<port> and http://<hostname>.local:<port> (mDNS)
        // straight out of the box, from any device on your LAN. Use "127.0.0.1"
        // to lock it to the mirror itself.
        host: "0.0.0.0",
        port: "5000",  // port on host where UI will be accessible via web browser
        updateInterval: 5000, // request DB every N miliseconds (5 sec by default)
        // Leave null to auto-detect: prefers the module's own .venv (created by
        // scripts/setup.sh), then falls back to "python3". Set a path/command
        // explicitly only if you need to override that.
        pythonPath: null,
        css: 0,  // 0 - current default MM CSS styles; 1 - custom css stile
        // TextStyle could be "xsmall bright" or "medium bright" or another one defined in /home/pi/MagicMirror/css/main.css, or in your own custom CSS
        nameTextStyle: "xsmall bright", // style for Note Name
        contentTextStyle: "normal dimmed", // style for Note Content
        animationSpeed: 2.5 * 1000,  // speed of text fading and changing in 2.5 sec
        // Give every note its own text color from the Miyazaki-16 palette
        // (https://lospec.com/palette-list/miyazaki-16), minus its three
        // darkest colors (too low contrast on the mirror). The color is
        // derived from the note title, so a note keeps its color when other
        // notes come and go.
        coloredNotes: false,
        // Show a small QR code above the notes that points to the web UI
        // (http://<MIRROR_IP>:<port>) so phones can scan their way to it.
        QRCode: false,
        qrCodeSize: 120,  // width/height of the QR code in pixels
    },

    start: function () {
        //started at module loading
        this.sendSocketNotification("START_FAST_NOTES", this.config);
        this.todoList = [];
        this.updAnimationSpeed = 0;
        this.webUiUrl = null;
        this.startUpdateLoop();
    },

    socketNotificationReceived: function (notification, payload) {
        console.log(notification);
        if (notification === "DATABASE") {
            if (this.todoList != payload) {
                this.todoList = payload;
                this.updAnimationSpeed = this.config.animationSpeed;
            }
            else{
                this.updAnimationSpeed = 0;
            }
        }
        if (notification === "FAST_NOTES_URL") {
            this.webUiUrl = payload;
            this.updateDom(0);
        }
    },

    // Gets correct css file from config.js
    getStyles: function () {
        if (this.config.css == 0) {
            return ["modules/MMM-FastNotes/css/default.css"];
        }
        if (this.config.css == 1) {
            return ["modules/MMM-FastNotes/css/custom.css"];
        }
    },

    getScripts: function () {
        if (this.config.QRCode) {
            return [this.file("node_modules/qr-code-styling/lib/qr-code-styling.js")];
        }
        return [];
    },

    // Miyazaki-16 palette (by skeddles, https://lospec.com/palette-list/miyazaki-16)
    // without the three darkest colors #232228, #284261, #5f5854 - their
    // contrast against the black mirror background is too low.
    noteColors: [
        "#878573", "#b8b095", "#c3d5c7", "#ebecdc",
        "#2485a6", "#54bad2", "#754d45", "#c65046", "#e6928a",
        "#1e7453", "#55a058", "#a1bf41", "#e3c054"
    ],

    // djb2 string hash -> stable palette index for a given note title
    noteColor: function (title) {
        let hash = 5381;
        const text = String(title || "");
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
        }
        return this.noteColors[Math.abs(hash) % this.noteColors.length];
    },

    startUpdateLoop: function () {
        setInterval(() => {
            this.updateEvents()
        }, this.config.updateInterval + 2000);
    },

    updateEvents: function () {
        this.updateDom(this.updAnimationSpeed);
        this.updAnimationSpeed = 0;
    },

    getDom: function () {
        var wrapper = document.createElement("div");
        if (this.config.QRCode && this.webUiUrl && typeof QRCodeStyling !== "undefined") {
            wrapper.appendChild(this.buildQrCode());
        }
        const tableEl = document.createElement('table');
        if (this.todoList.length > 0) {
            this.todoList.forEach((item) => {
                const color = this.config.coloredNotes ? this.noteColor(item.Title) : null;
                // name of note
                const rowOne = document.createElement('tr');
                const nameEl = document.createElement('td');
                nameEl.innerText = item.Title;
                nameEl.align = 'left';
                nameEl.className = this.config.nameTextStyle;
                if (color) {
                    nameEl.style.color = color;
                }
                rowOne.appendChild(nameEl);
                // content of note
                const rowTwo = document.createElement('tr');
                const textEl = document.createElement('td');
                textEl.innerText = item.Text;
                textEl.align = 'left';
                textEl.className = this.config.contentTextStyle;
                if (color) {
                    textEl.style.color = color;
                }
                rowTwo.appendChild(textEl);

                tableEl.appendChild(rowOne);
                tableEl.appendChild(rowTwo);
                wrapper.appendChild(tableEl);
            });
        } else {
            // text node, not innerHTML: rewriting innerHTML would wipe the
            // already rendered QR canvas appended above
            wrapper.appendChild(document.createTextNode("No Notes..."));
        }
        return wrapper;
    },

    // Small rounded QR code pointing at the web UI. The white padded box is
    // the quiet zone a scanner needs against the black mirror background.
    buildQrCode: function () {
        const box = document.createElement("div");
        box.className = "MMM-FastNotes-qrcode";
        box.style.cssText = "display:inline-block;background:#fff;padding:6px;border-radius:8px;margin-bottom:8px;line-height:0;";
        const size = Number(this.config.qrCodeSize) || 120;
        const qr = new QRCodeStyling({
            width: size,
            height: size,
            type: "canvas",
            data: this.webUiUrl,
            margin: 0,
            qrOptions: { errorCorrectionLevel: "M" },
            dotsOptions: { color: "#000", type: "rounded" },
            backgroundOptions: { color: "#fff" },
            cornersSquareOptions: { type: "extra-rounded" },
            cornersDotOptions: { type: "dot" }
        });
        qr.append(box);
        return box;
    }
});
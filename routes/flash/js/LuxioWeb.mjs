import {
  ESPLoader,
  Transport,
} from 'https://unpkg.com/esptool-js@0.4.1/bundle.js';
import LuxioSerial from './LuxioSerial.mjs';
import LuxioUtil from './LuxioUtil.mjs';

export default class LuxioWeb {

  luxioSerial = null;

  debug(...props) {
    console.log('[LuxioWeb]', ...props);
  }

  constructor() {
    const searchParams = new URL(window.location.href).searchParams;

    this.options = {
      flash: searchParams.has('flash')
        ? searchParams.get('flash') === 'yes'
        : true,
      erase: searchParams.has('erase')
        ? searchParams.get('erase') === 'yes'
        : true,
      config: searchParams.has('config')
        ? searchParams.get('config') === 'yes'
        : true,
      wifi: searchParams.has('wifi')
        ? searchParams.get('wifi') === 'yes'
        : true,
    };

    this.$title = document.getElementById('title');
    this.$subtitle = document.getElementById('subtitle');
    this.$throbber = document.getElementById('throbber');
    this.$stepFlash = document.getElementById('step-flash');
    this.$stepConfig = document.getElementById('step-config');
    this.$stepConfigNext = document.getElementById('step-config-next');
    this.$stepConfigNameInput = document.getElementById('step-config-name-input');
    this.$stepConfigTypeInputs = {
      'WS2812': document.getElementById('step-config-type-ws2812'),
      'SK6812': document.getElementById('step-config-type-sk6812'),
    };
    this.$stepConfigCountInput = document.getElementById('step-config-count-input');
    this.$stepConfigPinInput = document.getElementById('step-config-pin-input');
    this.$stepWiFi = document.getElementById('step-wifi');
    this.$flashButton = document.getElementById('flash-button');
    this.$flashProgress = document.getElementById('flash-progress');
    this.$wifiNetworks = document.getElementById('wifi-networks');

    Promise.resolve().then(async () => {
      if (!navigator.serial) {
        throw new Error('Please use Google Chrome, Microsoft Edge or Opera.');
      }

      // // Show Flash step
      this.$stepFlash.classList.add('is-visible');

      // Get Device
      const device = await new Promise((resolve, reject) => {
        this.$flashButton.addEventListener('click', async (e) => {
          if (this.$flashButton.classList.contains('is-flashing')) return;
          if (this.$flashButton.classList.contains('is-disabled')) return;

          navigator.serial.requestPort({
            // filters: e.altKey // Show all devices when ALT is pressed
            //   ? []
            //   : [
            //     { usbVendorId: 0x1A86 }, // CH341 USB Serial (Wemos D1 Mini)
            //   ],
          })
            .then(device => resolve(device))
            .catch(err => {
              if (err?.message?.includes('No port selected by the user.')) return;
              reject(err);
            });
        });
      });

      // Animate button
      this.$flashButton.classList.add('is-flashing');

      // TODO: Once done this fires
      device.addEventListener('disconnect', () => {
        this.$title.textContent = 'Device disconnected.';
        this.$subtitle.textContent = 'Please reconnect the device and try again.';
        this.$flashButton.classList.remove('is-flashing');
        this.$flashButton.classList.add('is-errored');
      });

      // Create Transport
      const transport = new Transport(device);

      // Create ESPLoader
      const esploader = new ESPLoader({
        transport,
        baudrate: 115200,
        terminal: {
          clean: () => {
            this.debug('[Terminal:clean]');
          },
          writeLine: (line) => {
            this.debug('[Terminal:line]', line);
          },
          write: (data) => {
            this.debug('[Terminal:write]', data);
          },
        },
      });

      // Get Chip
      const chip = await esploader.main();
      this.debug(`Chip: ${chip}`);
      if (!chip.startsWith('ESP8266')) {
        throw new Error(`Unknown Chip: ${chip}`);
      }

      const mac = await esploader.chip.readMac(esploader)
        .then(mac => mac.toUpperCase());
      this.debug(`MAC: ${mac}`);

      this.$title.textContent = 'Flashing...';
      this.$subtitle.textContent = 'This might take a few minutes.';
      this.$flashProgress.style.width = '2%';

      // Download Firmware
      if (this.options.flash) {
        const url = new URL('https://ota.luxio.lighting');
        url.searchParams.append('platform', 'ESP8266');
        url.searchParams.append('id', mac ?? '00:00:00:00:00:00');
        url.searchParams.append('version', '-1');

        const res = await fetch(url);
        if (res.status === 304) {
          throw new Error('There is no firmware available.');
        }
        if (!res.ok) {
          const body = await res.json();
          if (body.error) {
            throw new Error(body.error);
          }

          throw new Error('Failed to download the firmware.');
        }

        const version = res.headers.get('x-luxio-version');
        this.debug(`Firmware Version: ${version}`);

        // TODO: Check MD5
        const md5 = res.headers.get('x-md5');
        this.debug(`Firmware MD5: ${md5}`);

        // Download Blob
        const blob = await res.blob();

        // Create Reader
        const reader = new FileReader();;
        reader.readAsBinaryString(blob);

        // Download Blob into Reader
        const firmware = await new Promise((resolve, reject) => {
          reader.onload = () => {
            resolve(reader.result);
          };
          reader.onerror = err => {
            reject(err);
          };
        });

        this.$flashProgress.style.width = '3%';

        // Flash Firmware
        await esploader.writeFlash({
          fileArray: [{
            data: firmware,
            address: 0x0,
          }],
          flashSize: 'keep',
          eraseAll: this.options.erase,
          compress: true,
          reportProgress: (fileIndex, written, total) => {
            this.$flashProgress.style.width = 4 + (written / total * (100 - 4)) + '%';
          },
        });
      }

      // Reset & Disconnect ESPLoader
      await esploader.hardReset();
      await transport.disconnect();

      // this.$flashButton.style.opacity = 0;
      this.$stepFlash.classList.remove('is-visible');

      // Connect to Luxio over Serial
      let serialConnected = false;
      while (serialConnected === false) {
        if (!this.luxioSerial) {
          this.luxioSerial = new LuxioSerial({ device });
          await this.luxioSerial.open();
          await new Promise(resolve => {
            this.luxioSerial.once('system.ready', () => {
              this.debug('System Ready');
              serialConnected = true;
              resolve();
            });
          });
        }
      }

      // Get Initial Config
      let deviceName = await this.luxioSerial.system.getName();
      this.debug(`Device Name: ${deviceName}`);

      let ledType = await this.luxioSerial.led.getType();
      this.debug(`LED Type: ${ledType}`);

      let ledCount = await this.luxioSerial.led.getCount();
      this.debug(`LED Count: ${ledCount}`);

      let ledPin = await this.luxioSerial.led.getPin();
      this.debug(`LED Pin: ${ledPin}`);

      // Show Config
      if (this.options.config) {
        await new Promise((resolve, reject) => {
          this.$stepConfig.classList.add('is-visible');
          this.$title.textContent = 'Setup your Luxio';
          this.$subtitle.textContent = 'Configure Luxio to make it your own.';

          // Name
          this.$stepConfigNameInput.value = deviceName;
          this.$stepConfigNameInput.placeholder = deviceName;
          this.$stepConfigNameInput.addEventListener('change', e => {
            const name = e.target.value;
            if (name === '') {
              this.$stepConfigNameInput.value = deviceName;
              return;
            }

            this.luxioSerial.system.setName({ name })
              .then(() => {
                deviceName = name;
              })
              .catch(err => {
                this.debug(err);
                alert(err.message);
              });
          });

          // LED Type
          this.$stepConfigTypeInputs[ledType].checked = true;
          this.$stepConfigTypeInputs.WS2812.addEventListener('change', e => {
            const type = e.target.value;

            this.luxioSerial.led.setType({ type })
              .then(() => {
                ledType = type;
              })
              .catch(err => {
                this.debug(err);
                alert(err.message);
              });
          });

          this.$stepConfigTypeInputs.SK6812.addEventListener('change', e => {
            const type = e.target.value;

            this.luxioSerial.led.setType({ type })
              .then(() => {
                ledType = type;
              })
              .catch(err => {
                this.debug(err);
                alert(err.message);
              });
          });

          // LED Count
          this.$stepConfigCountInput.value = ledCount;
          this.$stepConfigCountInput.placeholder = `${this.$stepConfigCountInput.min} - ${this.$stepConfigCountInput.max}`;
          this.$stepConfigCountInput.addEventListener('change', e => {
            const count = Number(e.target.value);
            if (Number.isNaN(count) || count < e.target.min || count > e.target.max) {
              this.$stepConfigCountInput.value = ledCount;
              return;
            }

            this.luxioSerial.led.setCount({ count })
              .then(() => {
                ledCount = count;
              })
              .catch(err => {
                this.debug(err);
                alert(err.message);
              });
          });

          // LED Pin
          this.$stepConfigPinInput.value = ledPin;
          this.$stepConfigPinInput.addEventListener('change', e => {
            const pin = Number(e.target.value);

            this.luxioSerial.led.setPin({ pin })
              .then(() => {
                ledPin = pin;
              })
              .catch(err => {
                this.debug(err);
                alert(err.message);
              });
          });

          // Next
          this.$stepConfigNext.addEventListener('click', () => {
            this.$stepConfig.classList.remove('is-visible');
            resolve();
          });
        });
      }

      // Connect to Wi-Fi
      if (this.options.wifi) {
        let wifiConnected = false;
        while (wifiConnected === false) {
          this.$stepWiFi.classList.add('is-visible');
          this.$title.textContent = 'Scanning...';
          this.$subtitle.textContent = 'Luxio is scanning for Wi-Fi networks...';
          this.$throbber.classList.add('is-visible');

          // Scan for Networks
          await this.luxioSerial.wifi.scanNetworks();
          const networks = await Promise.race([
            new Promise(resolve => {
              this.luxioSerial.once('wifi.networks', resolve);
            }),
            LuxioUtil.wait(10000).then(() => {
              throw new Error('Failed to scan networks');
            }),
          ]);

          // Ask user to select network & enter password
          this.$title.textContent = 'Wi-Fi Networks';
          this.$subtitle.textContent = Object.values(networks).length > 0
            ? `Choose the Wi-Fi network you'd like to connect to.`
            : `No networks have been found. However, you can connect to a network manually.`;
          this.$throbber.classList.remove('is-visible');

          const {
            ssid,
            pass,
          } = await new Promise((resolve, reject) => {
            const networksObj = networks.reduce((result, network) => {
              // Skip if we already have a network with a stronger signal
              if (result[network.ssid] && result[network.ssid].rssi > network.rssi) return result;

              result[network.ssid] = network;
              return result;
            }, {});

            // Sort by signal strength
            const networksArr = Object.values(networksObj).sort((a, b) => b.rssi - a.rssi);

            // Render networks
            for (const [i, network] of Object.entries(networksArr)) {
              const $wifiNetwork = document.createElement('div');
              $wifiNetwork.classList.add('wifi-network');
              $wifiNetwork.addEventListener('click', async () => {
                // Hide others
                for (const $network of this.$wifiNetworks.querySelectorAll('.wifi-network')) {
                  $network.classList.remove('is-selected');
                }

                $wifiNetworkHiddenName.value = '';
                $wifiNetworkHiddenPasswordInput.value = '';

                $wifiNetwork.classList.add('is-selected');

                setTimeout(() => {
                  if ($wifiNetworkPasswordInput) {
                    $wifiNetworkPasswordInput.focus();
                  }
                }, 100);
              });
              this.$wifiNetworks.appendChild($wifiNetwork);

              const $wifiNetworkRowTop = document.createElement('div');
              $wifiNetworkRowTop.classList.add('wifi-network-row');
              $wifiNetworkRowTop.classList.add('is-visible');
              $wifiNetwork.appendChild($wifiNetworkRowTop);

              const $wifiNetworkName = document.createElement('div');
              $wifiNetworkName.classList.add('wifi-network-name');
              $wifiNetworkName.textContent = network.ssid;
              $wifiNetworkRowTop.appendChild($wifiNetworkName);

              const $wifiNetworkIcon = document.createElement('div');
              $wifiNetworkIcon.classList.add('wifi-network-icon');
              $wifiNetworkIcon.dataset.icon = network.encryption === 'none'
                ? network.rssi > -55
                  ? 'good-insecure'
                  : 'poor-insecure'
                : network.rssi > -55
                  ? 'good-secure'
                  : 'poor-secure';
              $wifiNetworkRowTop.appendChild($wifiNetworkIcon);

              const $wifiNetworkRowBottom = document.createElement('div');
              $wifiNetworkRowBottom.classList.add('wifi-network-row');
              $wifiNetwork.appendChild($wifiNetworkRowBottom);

              const $wifiNetworkPasswordOuter = document.createElement('div');
              $wifiNetworkPasswordOuter.classList.add('wifi-network-password-outer');
              $wifiNetworkRowBottom.appendChild($wifiNetworkPasswordOuter);

              const $wifiNetworkPasswordInner = document.createElement('div');
              $wifiNetworkPasswordInner.classList.add('wifi-network-password-inner');
              $wifiNetworkPasswordOuter.appendChild($wifiNetworkPasswordInner);

              let $wifiNetworkPasswordInputWrap;
              let $wifiNetworkPasswordInput;
              if (network.encryption !== 'none') {
                $wifiNetworkPasswordInputWrap = document.createElement('div');
                $wifiNetworkPasswordInputWrap.classList.add('wifi-network-password-input-wrap');
                $wifiNetworkPasswordInner.appendChild($wifiNetworkPasswordInputWrap);

                $wifiNetworkPasswordInput = document.createElement('input');
                $wifiNetworkPasswordInput.classList.add('wifi-network-password-input');
                $wifiNetworkPasswordInput.type = 'text';
                $wifiNetworkPasswordInput.placeholder = 'Password';
                $wifiNetworkPasswordInput.addEventListener('keydown', e => {
                  if (e.key === 'Enter') {
                    $wikiNetworkConnect.click();
                  }
                });
                $wifiNetworkPasswordInputWrap.appendChild($wifiNetworkPasswordInput);
              }

              const $wikiNetworkConnect = document.createElement('div');
              $wikiNetworkConnect.classList.add('wifi-network-connect');
              $wikiNetworkConnect.textContent = 'Connect';
              $wikiNetworkConnect.addEventListener('click', async () => {
                let pass = '';
                if ($wifiNetworkPasswordInput) {
                  pass = $wifiNetworkPasswordInput.value;
                  if (!pass) return;
                }

                resolve({ ssid: network.ssid, pass });
              });
              $wifiNetworkPasswordInner.appendChild($wikiNetworkConnect);

              setTimeout(() => {
                $wifiNetwork.classList.add('is-visible');
              }, i * 50);
            }

            // Hidden Network
            const $wifiNetworkHidden = document.createElement('div');
            $wifiNetworkHidden.classList.add('wifi-network');
            $wifiNetworkHidden.addEventListener('click', async () => {
              setTimeout(() => {
                $wifiNetworkHiddenName.focus();
              }, 100);
            });
            this.$wifiNetworks.appendChild($wifiNetworkHidden);

            const $wifiNetworkRowTop = document.createElement('div');
            $wifiNetworkRowTop.classList.add('wifi-network-row');
            $wifiNetworkRowTop.classList.add('is-visible');
            $wifiNetworkHidden.appendChild($wifiNetworkRowTop);

            const $wifiNetworkHiddenName = document.createElement('input');
            $wifiNetworkHiddenName.classList.add('wifi-network-name');
            $wifiNetworkHiddenName.classList.add('wifi-network-name-input');
            $wifiNetworkHiddenName.placeholder = 'Hidden Network...';
            $wifiNetworkHiddenName.addEventListener('focus', () => {
              // Hide others
              for (const $network of this.$wifiNetworks.querySelectorAll('.wifi-network')) {
                $network.classList.remove('is-selected');
              }
            });
            $wifiNetworkHiddenName.addEventListener('keyup', () => {
              if ($wifiNetworkHiddenName.value.length) {
                // Hide others
                for (const $network of this.$wifiNetworks.querySelectorAll('.wifi-network')) {
                  $network.classList.remove('is-selected');
                }

                $wifiNetworkHidden.classList.add('is-selected');
              }
            });
            $wifiNetworkRowTop.appendChild($wifiNetworkHiddenName);

            const $wifiNetworkRowBottom = document.createElement('div');
            $wifiNetworkRowBottom.classList.add('wifi-network-row');
            $wifiNetworkHidden.appendChild($wifiNetworkRowBottom);

            const $wifiNetworkPasswordOuter = document.createElement('div');
            $wifiNetworkPasswordOuter.classList.add('wifi-network-password-outer');
            $wifiNetworkRowBottom.appendChild($wifiNetworkPasswordOuter);

            const $wifiNetworkPasswordInner = document.createElement('div');
            $wifiNetworkPasswordInner.classList.add('wifi-network-password-inner');
            $wifiNetworkPasswordOuter.appendChild($wifiNetworkPasswordInner);

            const $wifiNetworkPasswordInputWrap = document.createElement('div');
            $wifiNetworkPasswordInputWrap.classList.add('wifi-network-password-input-wrap');
            $wifiNetworkPasswordInner.appendChild($wifiNetworkPasswordInputWrap);

            const $wifiNetworkHiddenPasswordInput = document.createElement('input');
            $wifiNetworkHiddenPasswordInput.classList.add('wifi-network-password-input');
            $wifiNetworkHiddenPasswordInput.type = 'text';
            $wifiNetworkHiddenPasswordInput.placeholder = 'Password';
            $wifiNetworkHiddenPasswordInput.addEventListener('keydown', e => {
              if (e.key === 'Enter') {
                $wikiNetworkHiddenConnect.click();
              }
            });
            $wifiNetworkHiddenPasswordInput.addEventListener('click', e => {
              e.stopPropagation();
            });
            $wifiNetworkPasswordInputWrap.appendChild($wifiNetworkHiddenPasswordInput);

            const $wikiNetworkHiddenConnect = document.createElement('div');
            $wikiNetworkHiddenConnect.classList.add('wifi-network-connect');
            $wikiNetworkHiddenConnect.textContent = 'Connect';
            $wikiNetworkHiddenConnect.addEventListener('click', async () => {
              let ssid = $wifiNetworkHiddenName.value;
              if (!ssid) return;

              let pass = $wifiNetworkHiddenPasswordInput.value;

              resolve({ ssid, pass });
            });
            $wifiNetworkPasswordInner.appendChild($wikiNetworkHiddenConnect);

            setTimeout(() => {
              $wifiNetworkHidden.classList.add('is-visible');
            }, Object.keys(networks).length * 50);

          });

          this.$wifiNetworks.innerHTML = '';

          // Connect to network
          this.$title.textContent = 'Connecting...';
          this.$subtitle.textContent = `${deviceName} is connecting to ${ssid}...`;
          this.$throbber.classList.add('is-visible');

          await this.luxioSerial.wifi.connect({ ssid, pass });

          // Poll wifi.getState until connected
          await Promise.race([
            new Promise((resolve, reject) => {
              this.luxioSerial.on('wifi.ip', state => {
                resolve();
              });

              this.luxioSerial.once('wifi.disconnected', ({ reason }) => {
                reject(new Error(`Reason: ${reason}`));
              });
            }),
            LuxioUtil.wait(15000).then(() => {
              throw new Error('Timeout getting state');
            }),
          ])
            .then(() => {
              wifiConnected = true;
            })
            .catch(async err => {
              console.error(err);

              for (let i = 5; i > 0; i--) {
                this.$title.textContent = 'Connecting Failed';
                this.$subtitle.textContent = `${deviceName} couldn't connect to ${ssid}.\n\nTrying again in ${i}s...`;
                this.$throbber.classList.remove('is-visible');
                await LuxioUtil.wait(1000);
              }
            });
        }

        this.$title.textContent = 'All done!';
        this.$subtitle.textContent = `${deviceName} has been set up successfully.\n\nYou can now safely disconnect the device.`;
        this.$throbber.classList.remove('is-visible');

        // Set to Green
        for (let i = 0; i < 2; i++) {
          await this.luxioSerial.led.setColor({ r: 0, g: 255, b: 0, w: 0 });
          await new Promise(resolve => setTimeout(resolve, 300));
          await this.luxioSerial.led.setColor({ r: 0, g: 0, b: 0, w: 255 }); // TODO: RGB
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // TODO: LED Strip Type
      // TODO: LED Strip Count

    }).catch(err => {
      console.error(err);
      this.$title.textContent = 'Whoops.';
      this.$subtitle.textContent = err.message;

      document.querySelectorAll('.step').forEach($step => {
        $step.classList.remove('is-visible');
      });
    });
  }

}
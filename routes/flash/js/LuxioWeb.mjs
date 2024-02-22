import {
  ESPLoader,
  Transport,
} from 'https://unpkg.com/esptool-js@0.4.1/bundle.js';
import LuxioSerial from './LuxioSerial.mjs';
import LuxioUtil from './LuxioUtil.mjs';

export default class LuxioWeb {

  constructor() {
    const $title = document.getElementById('title');
    const $subtitle = document.getElementById('subtitle');
    const $stepFlash = document.getElementById('step-flash');
    const $stepWiFi = document.getElementById('step-wifi');
    const $flashButton = document.getElementById('flash-button');
    const $flashProgress = document.getElementById('flash-progress');
    const $wifiNetworks = document.getElementById('wifi-networks');

    Promise.resolve().then(async () => {
      if (!navigator.serial) {
        throw new Error('Please use Google Chrome, Microsoft Edge or Opera.');
      }

      // Show Flash step
      $stepFlash.classList.add('is-visible');

      // Get Device
      const device = await new Promise((resolve, reject) => {
        $flashButton.addEventListener('click', async (e) => {
          if ($flashButton.classList.contains('is-flashing')) return;
          if ($flashButton.classList.contains('is-disabled')) return;

          navigator.serial.requestPort({
            filters: e.altKey
              ? []
              : [
                { usbVendorId: 0x1A86 }, // CH341 USB Serial (Wemos D1 Mini)
              ],
          })
            .then(device => resolve(device))
            .catch(err => {
              if (err?.message?.includes('No port selected by the user.')) return;
              reject(err);
            });
        });
      });

      // Animate button
      $flashButton.classList.add('is-flashing');

      device.addEventListener('disconnect', () => {
        $title.textContent = 'Device disconnected.';
        $subtitle.textContent = 'Please reconnect the device and try again.';
        $flashButton.classList.remove('is-flashing');
        $flashButton.classList.add('is-errored');
      });

      // Create Transport
      const transport = new Transport(device);

      // Create ESPLoader
      const esploader = new ESPLoader({
        transport,
        baudrate: 115200,
        terminal: {
          clean() {
            console.log('[Terminal:clean]');
          },
          writeLine(line) {
            console.log('[Terminal:line]', line);
          },
          write(data) {
            console.log('[Terminal:write]', data);
          },
        },
      });

      // Get Chip
      const chip = await esploader.main();
      console.log(`Chip: ${chip}`);
      if (!chip.startsWith('ESP8266')) {
        throw new Error(`Unknown Chip: ${chip}`);
      }

      $title.textContent = 'Flashing...';
      $subtitle.textContent = 'This might take a few minutes.';
      $flashProgress.style.width = '2%';

      // Download Firmware
      const firmware = await this.getFirmware();

      $flashProgress.style.width = '3%';

      // TODO: https://developer.chrome.com/docs/web-platform/view-transitions/

      await esploader.writeFlash({
        fileArray: [{
          data: firmware,
          address: 0x0,
        }],
        flashSize: 'keep',
        eraseAll: true,
        compress: true,
        reportProgress(fileIndex, written, total) {
          $flashProgress.style.width = written / total * 100 + '%';
        },
        // calculateMD5Hash: image => {
        //  // TODO
        // },
      });

      await esploader.hardReset();
      await device.close();
      $flashButton.style.opacity = 0;
      $stepFlash.classList.remove('is-visible');

      $stepWiFi.classList.add('is-visible');
      $title.textContent = 'Scanning...';
      $subtitle.textContent = 'Luxio is scanning for Wi-Fi networks...';

      // Set Baudrate
      const luxioSerial = new LuxioSerial({ device });
      await luxioSerial.open();
      await new Promise(resolve => {
        luxioSerial.once('system.ready', resolve);
      });

      // Get Name
      const deviceName = await luxioSerial.system.getName();

      // Scan for Networks
      await luxioSerial.wifi.scanNetworks();
      const networks = await Promise.race([
        new Promise(resolve => {
          luxioSerial.once('wifi.networks', resolve);
        }),
        LuxioUtil.wait(10000).then(() => {
          throw new Error('Failed to scan networks');
        }),
      ]);

      // Ask user to select network & enter password
      $title.textContent = 'Wi-Fi Networks';
      $subtitle.textContent = `Choose the Wi-Fi network you want to connect to.`;

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
            for (const $network of $wifiNetworks.querySelectorAll('.wifi-network')) {
              $network.classList.remove('is-selected');
            }

            $wifiNetwork.classList.add('is-selected');

            setTimeout(() => {
              $wifiNetworkPasswordInput.focus();
            }, 100);
          });
          $wifiNetworks.appendChild($wifiNetwork);

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

          const $wifiNetworkPasswordInputWrap = document.createElement('div');
          $wifiNetworkPasswordInputWrap.classList.add('wifi-network-password-input-wrap');
          $wifiNetworkPasswordInner.appendChild($wifiNetworkPasswordInputWrap);

          const $wifiNetworkPasswordInput = document.createElement('input');
          $wifiNetworkPasswordInput.classList.add('wifi-network-password-input');
          $wifiNetworkPasswordInput.type = 'text';
          $wifiNetworkPasswordInput.placeholder = 'Password';
          $wifiNetworkPasswordInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
              $wikiNetworkConnect.click();
            }
          });
          $wifiNetworkPasswordInputWrap.appendChild($wifiNetworkPasswordInput);

          const $wikiNetworkConnect = document.createElement('div');
          $wikiNetworkConnect.classList.add('wifi-network-connect');
          $wikiNetworkConnect.textContent = 'Connect';
          $wikiNetworkConnect.addEventListener('click', async () => {
            const pass = $wifiNetworkPasswordInput.value;
            if (!pass) return;

            resolve({ ssid: network.ssid, pass });
          });
          $wifiNetworkPasswordInner.appendChild($wikiNetworkConnect);

          setTimeout(() => {
            $wifiNetwork.classList.add('is-visible');
          }, i * 50);
        }
      });

      $wifiNetworks.innerHTML = '';

      // Connect to network
      $title.textContent = 'Connecting...';
      $subtitle.textContent = `${deviceName} is connecting to ${ssid}...`;

      await luxioSerial.wifi.connect({ ssid, pass });

      // Poll wifi.getState until connected
      await Promise.race([
        new Promise((resolve, reject) => {
          luxioSerial.on('wifi.ip', state => {
            resolve();
          });

          luxioSerial.once('wifi.disconnected', ({ reason }) => {
            reject(new Error(`Reason: ${reason}`));
          });
        }),
        LuxioUtil.wait(15000).then(() => {
          throw new Error('Timeout getting state');
        }),
      ])
        .catch(err => {
          // TODO: Retry

          throw new Error(`${deviceName} couldn't connect to ${ssid}. Please try again.`);
        });

      // Set to Green
      for (let i = 0; i < 2; i++) {
        await luxioSerial.led.setColor({ r: 0, g: 255, b: 0, w: 0 });
        await new Promise(resolve => setTimeout(resolve, 300));
        await luxioSerial.led.setColor({ r: 0, g: 0, b: 0, w: 255 }); // TODO: RGB
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // TODO: LED Strip Type
      // TODO: LED Strip Count

      $title.textContent = 'All done!';
      $subtitle.textContent = `${deviceName} has been set up successfully.\n\nYou can now safely disconnect the device.`;

    }).catch(err => {
      console.error(err);
      $title.textContent = 'Whoops.';
      $subtitle.textContent = err.message;

      document.querySelectorAll('.step').forEach($step => {
        $step.classList.remove('is-visible');
      });
    });
  }

  async getFirmware() {
    // const url = new URL('https://ota.luxio.lighting');
    // url.searchParams.append('platform', 'WEMOS');
    // url.searchParams.append('id', '00:00:00:00:00:00');
    // url.searchParams.append('version', '0.0');

    const url = './build/firmware.bin';

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json();
      if (body.error) {
        throw new Error(body.error);
      }

      throw new Error('Failed to download firmware');
    }

    // Download Blob
    const blob = await res.blob();

    const reader = new FileReader();;
    reader.readAsBinaryString(blob);

    return new Promise((resolve, reject) => {
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = err => {
        reject(err);
      };
    });
  }

}
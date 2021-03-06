const {createBluetooth} = require('node-ble');
const {bluetooth, destroy} = createBluetooth();
const {
  UUIDS,
  CHAR_UUIDS,
  NOTIFICATION_TYPES,
} = require('./constants');


class MiBand4 {

  static constants() {
    return {
      NOTIFICATION_TYPES,
    };
  }

  constructor() {
    this.init();
  }

  init() {
    this.mac = null;
    this.device = null;
    this.serviceDev = null;
    this.charNotifications = null;
  }

  async connect(mac) {
    if (!mac) throw 'MAC not defined';

    const adapter = await bluetooth.defaultAdapter();
    console.log('wait device');
    this.device = await adapter.waitDevice(mac);
    console.log('connecting device');
    await this.device.connect();
    this.mac = mac;
    console.log('connected', mac);
    const gatt = await this.device.gatt();

    const serviceNotification = await gatt.getPrimaryService(UUIDS.notifications);
    this.serviceBand1 = await gatt.getPrimaryService(UUIDS.miband1);
    this.serviceDev = await gatt.getPrimaryService(UUIDS.devinfo);

    this.charNotifications = await serviceNotification.getCharacteristic(CHAR_UUIDS.notifications);
  }

  async disconnect() {
    console.log('disconnect', this.mac);
    await this.device.disconnect();
    this.init();
  }


  async sendNotification(message, type = NOTIFICATION_TYPES.msg) {
    console.log('sendNotification', {message});
    return this.charNotifications.writeValue(Buffer.from(type + message));
  }


  async getRevision() {
    const val = await this._getString(this.serviceDev, CHAR_UUIDS.revision);
    return val;
  }

  async getHRDWRevision() {
    const val = await this._getString(this.serviceDev, CHAR_UUIDS.hrdw_revision);
    return val;
  }

  async getSerial() {
    const val = await this._getString(this.serviceDev, CHAR_UUIDS.serial);
    return val;
  }

  async getBattery() {
    const char = await this.serviceBand1.getCharacteristic(CHAR_UUIDS.battery);
    const val = await char.readValue();
    const level = val.readInt8(1);
    const status = val.readInt8(2) ? 'charge' : 'normal';
    const last_charge_level = val.readInt8(19);
    const last_charge_date = this._parseDate(val, 11);
    const last_fullcharge_date = this._parseDate(val, 3);

    const result = {
      level,
      status,
      last_charge_level,
      last_charge_date,
      last_fullcharge_date,
    }
    return result;
  }

  async getTime() {
    const char = await this.serviceBand1.getCharacteristic(CHAR_UUIDS.current_time);
    const val = await char.readValue();
    const result = this._parseDate(val);
    return result;
  }

  _parseDate(buf, offset = 0) {
    if (buf.length - offset < 6) return {};

    const Y = buf.readInt16LE(offset);
    const m = buf.readInt8(offset+2);
    const d = buf.readInt8(offset+3);
    const H = buf.readInt8(offset+4);
    const i = buf.readInt8(offset+5);
    const s = buf.readInt8(offset+6);

    return (new Date(`${Y}-${m}-${d} ${H}:${i}:${s}`))
      // .getTime();
      // .toLocaleString();
  }


  async _getString(service, charUUID) {
    const char = await service.getCharacteristic(charUUID);
    const val = await char.readValue();
    return val.toString();
  }
}

module.exports = MiBand4;
const STORAGE_KEY = "sos.settings.v2";
const LAST_LOCATION_KEY = "sos.lastLocation.v2";
const PENDING_SOS_KEY = "sos.pending.v1";
const PANIC_TEST_NUMBER = "+918700523035";

const DEFAULTS = {
  name: "",
  contacts: {
    fire: "101",
    flood: "108",
    earthquake: "112",
    medical: "108",
    unknown: PANIC_TEST_NUMBER
  },
  smsNumber: PANIC_TEST_NUMBER,
  guardianCall: "",
  guardianSms: ""
};

const nameInput = document.getElementById("nameInput");
const guardianCallInput = document.getElementById("guardianCallInput");
const guardianSmsInput = document.getElementById("guardianSmsInput");
const fireInput = document.getElementById("fireInput");
const floodInput = document.getElementById("floodInput");
const earthquakeInput = document.getElementById("earthquakeInput");
const medicalInput = document.getElementById("medicalInput");
const unknownInput = document.getElementById("unknownInput");
const smsInput = document.getElementById("smsInput");
const quickDialInput = document.getElementById("quickDialInput");
const saveBtn = document.getElementById("saveBtn");
const panicBtn = document.getElementById("panicBtn");
const directDialBtn = document.getElementById("directDialBtn");
const guardianCallBtn = document.getElementById("guardianCallBtn");
const guardianSmsBtn = document.getElementById("guardianSmsBtn");
const sendPendingBtn = document.getElementById("sendPendingBtn");
const setupStatus = document.getElementById("setupStatus");
const runtimeStatus = document.getElementById("runtimeStatus");
const categoryButtons = document.querySelectorAll("[data-category]");

let volatileLocation = loadLastLocation();
let locationWatchId = null;

boot();

function boot() {
  hydrateForm();
  registerServiceWorker();
  requestLocationPermission(false);
  startLocationWatch();

  if (saveBtn) saveBtn.addEventListener("click", saveSettings);
  if (panicBtn) panicBtn.addEventListener("click", () => startSOS("unknown"));
  if (directDialBtn) directDialBtn.addEventListener("click", startDirectSOS);
  if (guardianCallBtn) guardianCallBtn.addEventListener("click", callGuardian);
  if (guardianSmsBtn) guardianSmsBtn.addEventListener("click", smsGuardian);
  if (sendPendingBtn) sendPendingBtn.addEventListener("click", sendPendingSOS);

  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", () => startSOS(btn.dataset.category || "unknown"));
  });

  window.addEventListener("online", () => {
    if (loadPendingSOS()) {
      setSetupStatus("Network is back. Tap Send Pending SOS.");
    }
  });

  const pending = loadPendingSOS();
  if (pending) {
    setSetupStatus("Pending SOS saved. Tap Send Pending SOS.");
  } else if (volatileLocation) {
    setSetupStatus("Location detected and saved.");
  } else {
    setSetupStatus("Allow location when prompted for better SMS accuracy.");
  }
}

function setSetupStatus(text) {
  if (setupStatus) {
    setupStatus.textContent = text;
  }
}

function setRuntimeStatus(text) {
  if (runtimeStatus) {
    runtimeStatus.textContent = text;
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
    } catch {
      // Ignore registration errors in demo mode.
    }
  });
}

function sanitizePhone(raw) {
  return String(raw || "")
    .trim()
    .replace(/[^\d+]/g, "")
    .replace(/(?!^)\+/g, "");
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return cloneDefaults();
    }

    const parsed = JSON.parse(saved);
    const contacts = parsed.contacts || {};

    return {
      name: parsed.name || "",
      contacts: {
        fire: DEFAULTS.contacts.fire,
        flood: DEFAULTS.contacts.flood,
        earthquake: DEFAULTS.contacts.earthquake,
        medical: DEFAULTS.contacts.medical,
        unknown: contacts.unknown || DEFAULTS.contacts.unknown
      },
      smsNumber: parsed.smsNumber || DEFAULTS.smsNumber,
      guardianCall: parsed.guardianCall || DEFAULTS.guardianCall,
      guardianSms: parsed.guardianSms || DEFAULTS.guardianSms
    };
  } catch {
    return cloneDefaults();
  }
}

function saveSettings() {
  const next = {
    name: nameInput.value.trim(),
    contacts: {
      fire: DEFAULTS.contacts.fire,
      flood: DEFAULTS.contacts.flood,
      earthquake: DEFAULTS.contacts.earthquake,
      medical: DEFAULTS.contacts.medical,
      unknown: sanitizePhone(unknownInput.value) || PANIC_TEST_NUMBER
    },
    smsNumber: sanitizePhone(smsInput.value) || PANIC_TEST_NUMBER,
    guardianCall: sanitizePhone(guardianCallInput.value),
    guardianSms: sanitizePhone(guardianSmsInput.value)
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  setSetupStatus("Saved offline settings.");
}

function hydrateForm() {
  const config = loadSettings();
  nameInput.value = config.name;
  guardianCallInput.value = config.guardianCall;
  guardianSmsInput.value = config.guardianSms;
  fireInput.value = config.contacts.fire;
  floodInput.value = config.contacts.flood;
  earthquakeInput.value = config.contacts.earthquake;
  medicalInput.value = config.contacts.medical;
  unknownInput.value = config.contacts.unknown;
  smsInput.value = config.smsNumber;
}

function loadLastLocation() {
  try {
    const saved = localStorage.getItem(LAST_LOCATION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function storeLastLocation(coords) {
  const snapshot = {
    lat: Number(coords.latitude.toFixed(6)),
    lng: Number(coords.longitude.toFixed(6)),
    ts: Date.now()
  };
  volatileLocation = snapshot;
  localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(snapshot));
}

function requestLocationPermission(showStatus) {
  if (!("geolocation" in navigator)) {
    if (showStatus) {
      setSetupStatus("Geolocation is not supported on this device/browser.");
    }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      storeLastLocation(pos.coords);
      if (showStatus) {
        setSetupStatus("Location updated.");
      }
    },
    () => {
      if (showStatus && !volatileLocation) {
        setSetupStatus("Location unavailable. SOS still works.");
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function startLocationWatch() {
  if (!("geolocation" in navigator) || locationWatchId !== null) {
    return;
  }

  locationWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      storeLastLocation(pos.coords);
    },
    () => {},
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
  );
}

function getLocationPayload(snapshot) {
  const data = snapshot || volatileLocation;
  if (!data) {
    return {
      text: "unavailable",
      mapLink: ""
    };
  }

  const coords = `${data.lat},${data.lng}`;
  return {
    text: coords,
    mapLink: `https://maps.google.com/?q=${coords}`
  };
}

function getBestLocation(timeoutMs) {
  if (!("geolocation" in navigator)) {
    return Promise.resolve(getLocationPayload());
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        storeLastLocation(pos.coords);
        resolve(getLocationPayload());
      },
      () => {
        resolve(getLocationPayload());
      },
      { enableHighAccuracy: true, timeout: timeoutMs || 12000, maximumAge: 0 }
    );
  });
}

function getCallNumberForCategory(category, config) {
  return config.contacts[category] || config.contacts.unknown || PANIC_TEST_NUMBER;
}

function smsHref(number, body) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const separator = isIOS ? "&" : "?";
  return `sms:${number}${separator}body=${encodeURIComponent(body)}`;
}

function buildSosMessage(category, config, location) {
  const reporter = config.name || "Unknown person";
  const timestamp = new Date().toLocaleString();
  const mapPart = location.mapLink ? ` Map: ${location.mapLink}` : "";

  return `HELP! Category: ${category}. From: ${reporter}. Time: ${timestamp}. GPS: ${location.text}.${mapPart}`;
}

function loadPendingSOS() {
  try {
    const saved = localStorage.getItem(PENDING_SOS_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function savePendingSOS(record) {
  localStorage.setItem(PENDING_SOS_KEY, JSON.stringify(record));
}

function dialNumber(number) {
  const clean = sanitizePhone(number);
  if (!clean) {
    return false;
  }
  window.location.href = `tel:${clean}`;
  return true;
}

function openSms(number, message) {
  const clean = sanitizePhone(number);
  if (!clean) {
    return false;
  }
  window.location.href = smsHref(clean, message);
  return true;
}

function triggerCallAndSms(callNumber, smsNumber, smsBody) {
  dialNumber(callNumber);
  setTimeout(() => {
    openSms(smsNumber, smsBody);
  }, 1200);
}

async function startSOS(category, directNumber) {
  const config = loadSettings();
  const selectedCategory = category || "unknown";
  const overrideNumber = sanitizePhone(directNumber || "");
  const callNumber = overrideNumber || getCallNumberForCategory(selectedCategory, config);
  const smsNumber = sanitizePhone(config.smsNumber) || callNumber;

  if (!callNumber) {
    setSetupStatus("No call number set. Add one in Setup first.");
    return;
  }

  setSetupStatus("Getting live GPS location...");
  const location = await getBestLocation(12000);
  const smsBody = buildSosMessage(selectedCategory, config, location);

  savePendingSOS({
    id: Date.now(),
    category: selectedCategory,
    callNumber,
    smsNumber,
    message: smsBody,
    createdAt: new Date().toISOString()
  });

  if (navigator.onLine) {
    setSetupStatus("SOS ready. Opening call and SMS now.");
  } else {
    setSetupStatus("Offline mode. Opening call/SMS now. If failed, tap Send Pending SOS later.");
  }

  setRuntimeStatus(`Dialing ${callNumber}. Then opening SMS to ${smsNumber}.`);
  triggerCallAndSms(callNumber, smsNumber, smsBody);
}

function sendPendingSOS() {
  const pending = loadPendingSOS();
  if (!pending) {
    setSetupStatus("No pending SOS found.");
    return;
  }

  setSetupStatus("Sending pending SOS...");
  triggerCallAndSms(pending.callNumber, pending.smsNumber, pending.message);
}

function startDirectSOS() {
  const directNumber = sanitizePhone(quickDialInput ? quickDialInput.value : "");
  if (!directNumber) {
    setSetupStatus("Enter a direct emergency number first.");
    return;
  }
  startSOS("direct", directNumber);
}

function callGuardian() {
  const config = loadSettings();
  const number = sanitizePhone(config.guardianCall) || sanitizePhone(config.contacts.unknown);

  if (!number) {
    setSetupStatus("Guardian call number not set.");
    return;
  }

  setSetupStatus(`Dialing guardian: ${number}.`);
  dialNumber(number);
}

async function smsGuardian() {
  const config = loadSettings();
  const number =
    sanitizePhone(config.guardianSms) ||
    sanitizePhone(config.guardianCall) ||
    sanitizePhone(config.smsNumber) ||
    sanitizePhone(config.contacts.unknown);

  if (!number) {
    setSetupStatus("Guardian SMS number not set.");
    return;
  }

  setSetupStatus("Getting live GPS location...");
  const location = await getBestLocation(12000);
  const message = buildSosMessage("guardian-alert", config, location);

  savePendingSOS({
    id: Date.now(),
    category: "guardian-alert",
    callNumber: number,
    smsNumber: number,
    message,
    createdAt: new Date().toISOString()
  });

  setSetupStatus(`Opening SMS to guardian: ${number}.`);
  openSms(number, message);
}

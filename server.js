require("dotenv").config();

const express = require("express");
const path = require("path");
const dns = require("dns").promises;
const net = require("net");

const app = express();

const PORT = Number(process.env.PORT || 3000);

const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || "")
  .split(",")
  .map(host => host.trim().toLowerCase())
  .filter(Boolean);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);

  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIPv6(ip) {
  const value = ip.toLowerCase();

  return (
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe80:")
  );
}

async function pointsToPrivateAddress(hostname) {
  const addresses = await dns.lookup(hostname, {
    all: true,
    verbatim: true
  });

  return addresses.some(({ address }) => {
    if (net.isIPv4(address)) {
      return isPrivateIPv4(address);
    }

    if (net.isIPv6(address)) {
      return isPrivateIPv6(address);
    }

    return true;
  });
}

function isAllowedHost(hostname) {
  const host = hostname.toLowerCase();

  return ALLOWED_HOSTS.some(allowed => {
    return host === allowed || host.endsWith("." + allowed);
  });
}

app.get("/api/status", (req, res) => {
  res.json({
    online: true
  });
});

app.post("/api/proxy", async (req, res) => {
  try {
    let target;

    try {
      target = new URL(req.body?.url);
    } catch {
      return res.status(400).json({
        error: "Invalid URL."
      });
    }

    if (!["http:", "https:"].includes(target.protocol)) {
      return res.status(400).json({
        error: "Only HTTP and HTTPS URLs are supported."
      });
    }

    if (!isAllowedHost(target.hostname)) {
      return res.status(403).json({
        error: "This hostname is not allowed."
      });
    }

    if (await pointsToPrivateAddress(target.hostname)) {
      return res.status(403).json({
        error: "Private/internal addresses are blocked."
      });
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    try {
      const response = await fetch(target, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,

        headers: {
          "User-Agent": "FastProxy/1.0"
        }
      });

      const contentType =
        response.headers.get("content-type") ||
        "application/octet-stream";

      const body = await response.arrayBuffer();

      res.status(response.status);

      res.set(
        "Content-Type",
        contentType
      );

      res.set(
        "X-Proxy-Status",
        "OK"
      );

      res.send(Buffer.from(body));
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error(error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Request timed out."
      });
    }

    res.status(502).json({
      error: "Could not reach the destination."
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

app.listen(PORT, () => {
  console.log(
    `Fast Proxy running on port ${PORT}`
  );
});

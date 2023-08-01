const os = require("os");
const fs = require("fs");
const path = require("path");

const core = require("@actions/core");
const github = require("@actions/github");
const tc = require("@actions/tool-cache");

function getPlatform() {
  const platform = os.platform();

  const mappings = {
    win32: "windows",
  };

  return mappings[platform] || platform;
}

function getArch() {
  const arch = os.arch();

  if (arch === "arm") {
    return `armv${process.config.variables.arm_version}`;
  }

  const mappings = {
    x32: "386",
    x64: "amd64",
  };

  return mappings[arch] || arch;
}

async function getVersion(token, version) {
  try {
    const octokit = new github.getOctokit(token);

    let release;
    if (tag && tag !== "latest") {
      core.info(`checking GitHub for version '${version}'`);
      release = await octokit.rest.repos.getReleaseByTag({
        owner,
        repo,
        version,
      });
    } else {
      core.info(`checking GitHub for latest tag`);
      release = await octokit.rest.repos.getLatestRelease({
        owner,
        repo,
      });
    }

    return release.tag_name.replace(/^v/, "");
  } catch (err) {
    if (err.status === 404) {
      throw new Error(
        `unable to find '${version}' - use 'latest' or see https://github.com/${owner}/${repo}/releases for details`
      );
    } else {
      throw err;
    }
  }
}

async function download(url) {
  const pathDownload = await tc.downloadTool(url);
  core.info(pathDownload);

  let pathExtract;
  if (os.platform().startsWith("win")) {
    pathExtract = await tc.extractZip(pathDownload);
  } else {
    pathExtract = await tc.extractTar(pathDownload);
  }
  core.info(pathExtract);

  if (!pathDownload || !pathExtract) {
    throw new Error(`unable to download waypoint from ${url}`);
  }

  return pathExtract;
}

async function run() {
  try {
    const token = core.getInput("github-token", { required: true });
    let version = core.getInput("version") || "latest";

    const platform = await getPlatform();
    const arch = await getArch();

    version = await getVersion(token, version);
    const url = `${baseURL}/${version}/waypoint_${platform}_${arch}.zip`;

    const pathToCLI = await download(url);
    core.addPath(pathToCLI);
  } catch (error) {
    core.setFailed(error);
  }
}

run();

const fs = require('fs');
const path = require('path');
const COS = require('cos-nodejs-sdk-v5');
const config = require('./deployinfo-tencent');

const { Region, SecretId, SecretKey, Bucket, Directory, CleanOldFiles } = config;

const client = new COS({
  SecretId,
  SecretKey
});

const promisify = (c, f, params = {}) => {
  return new Promise((resolve, reject) => {
    c[f]({
      Bucket,
      Region,
      ...params
    }, (err, data) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(data);
      }
    });
  });
};

const distPath = path.resolve(__dirname, Directory);

async function clean() {
  console.log('[*] Getting file list');
  const fileList = await promisify(client, 'getBucket');
  if (fileList.Contents && fileList.Contents.length > 0) {
    console.log('[*] Deleting old files');
    await promisify(client, 'deleteMultipleObject', {
      Objects: fileList.Contents.map(x => { return { Key: x.Key } })
    });
  }
}

async function upload(subpath = '') {
  const dir = await fs.promises.readdir(`${distPath}${subpath}`);
  for (i of dir) {
    const stat = await fs.promises.stat(path.resolve(`${distPath}${subpath}`, i));

    if (stat.isFile()) {
      const fileStream = fs.createReadStream(path.resolve(`${distPath}${subpath}`, i));
      console.log(`Uploading: ${subpath}/${i}`);
      await promisify(client, 'putObject', {
        Key: `${subpath}/${i}`,
        StorageClass: 'STANDARD',
        Body: fileStream
      });
    } else if (stat.isDirectory()) {
      await upload(`${subpath}/${i}`);
    }
  }
}

async function deploy() {
  if (CleanOldFiles) {
    await clean();
  }
  await upload();
  console.log('[*] Done');
}

deploy();
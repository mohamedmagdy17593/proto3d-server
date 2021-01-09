import puppeteer from 'puppeteer';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

export async function requestUploadModel(url: string) {
  let { buffer } = await downloadModel(url);
  await uploadModelToCloudinary(buffer);
}

const LOGIN_URL = 'https://sketchfab.com/login';

const LOGIN_USER = {
  email: process.env.SKETCHFAB_EMAIL!,
  password: process.env.SKETCHFAB_PASSWORD!,
};

async function downloadModel(url: string) {
  return new Promise<{ buffer: any }>(async resolve => {
    console.log('Start browser');
    let browser = await puppeteer.launch();
    let page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);

    console.log('Goto login page');
    await page.goto(LOGIN_URL);
    // wait for the page to load
    await page.waitForSelector('[name="email"]');
    await page.waitForSelector('[name="password"]');
    // fill login form then login
    let emailField = await page.$('[name="email"]');
    await emailField?.type(LOGIN_USER.email);
    let passwordField = await page.$('[name="password"]');
    await passwordField?.type(LOGIN_USER.password);
    await page.$eval('[data-selenium="submit-button"]', btn =>
      (btn as HTMLButtonElement).click(),
    );
    console.log('Login success');

    // wait until login is complete
    await page.waitForNavigation();

    console.log(`Goto model page ${url}`);
    await page.goto(url);

    // click on download button
    await page.$eval('[data-selenium="open-download-popup"]', btn =>
      (btn as HTMLButtonElement).click(),
    );

    // setup page request interceptor
    await page.setRequestInterception(true);
    page.on('request', async request => {
      if (request.url().indexOf('sketchfab-prod-media.s3') > 0) {
        console.log(`Found download link: ${request.url()}`);

        // @ts-expect-error hack
        let headers = request._headers;
        const cookies = await page.cookies();
        headers.Cookie = cookies.map(ck => ck.name + '=' + ck.value).join(';');

        console.log('Start downloading');
        let { data: buffer } = await axios({
          // @ts-expect-error hack
          url: request._url,
          // @ts-expect-error hack
          method: request._method,
          // @ts-expect-error hack
          data: request._postData,
          responseType: 'arraybuffer',
          headers,
        });
        console.log('End downloading');
        console.log(`Exit browser`);
        browser.close();

        resolve({ buffer });
      } else {
        request.continue();
      }
    });

    // click on gltf button to download
    console.log(`Waiting for download link`);
    await page.waitForSelector('.button.btn-primary.btn-large.button-gltf');
    await page.$eval('.button.btn-primary.btn-large.button-gltf', btn =>
      (btn as HTMLButtonElement).click(),
    );
  });
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadModelToCloudinary(buffer: any) {
  return new Promise((resolve, reject) => {
    console.log('Upload file to cloudinary');
    let uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'proto3d-models',
        resource_type: 'image',
      },
      (error: any, result: any) => {
        if (result) {
          console.log('Upload file is successful');
          resolve(result);
        } else {
          console.log('Upload file is failed', error);
          reject(error);
        }
      },
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

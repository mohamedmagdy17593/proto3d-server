import puppeteer from 'puppeteer';
import axios from 'axios';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import { ModelStatus, SketchfabModel } from '../type';
import prisma from './prisma';

export async function requestUploadModel(sketchfabModel: SketchfabModel) {
  let { id } = sketchfabModel;
  try {
    await prisma.model.update({
      where: { id },
      data: {
        status: 'uploading' as ModelStatus,
        statusMessage: 'Finding model',
      },
    });
    let { buffer } = await downloadModel(sketchfabModel);
    await prisma.model.update({
      where: { id },
      data: { statusMessage: 'Done downloading 🎉 and start uploading' },
    });
    let { secure_url } = await uploadModelToCloudinary(buffer);
    let gltfUrl = secure_url.replace(/\.gltz$/, '.gltf');
    await prisma.model.update({
      where: { id },
      data: {
        status: 'uploaded' as ModelStatus,
        statusMessage: 'Saved to our server 🎉',
        gltfUrl,
      },
    });
  } catch {
    await prisma.model.update({
      where: { id },
      data: {
        status: 'error-while-uploading' as ModelStatus,
        statusMessage: 'Error while uploading, please try again later',
      },
    });
  }
}

const LOGIN_URL = 'https://sketchfab.com/login';

const LOGIN_USER = {
  email: process.env.SKETCHFAB_EMAIL!,
  password: process.env.SKETCHFAB_PASSWORD!,
};

async function downloadModel(sketchfabModel: SketchfabModel) {
  let { id, sketchfabUrl } = sketchfabModel;

  return new Promise<{ buffer: any }>(async resolve => {
    console.log('Start browser');
    let browser = await puppeteer.launch({ args: ['--no-sandbox'] });
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

    console.log(`Goto model page ${sketchfabUrl}`);
    await prisma.model.update({
      where: { id },
      data: { statusMessage: 'Model Founded' },
    });
    await page.goto(sketchfabUrl);

    // click on download button
    await page.$eval('[data-selenium="open-download-popup"]', btn =>
      (btn as HTMLButtonElement).click(),
    );

    // setup page request interceptor
    await page.setRequestInterception(true);
    page.on('request', async request => {
      if (request.url().indexOf('sketchfab-prod-media.s3') > 0) {
        console.log(`Found download link: ${request.url()}`);
        await prisma.model.update({
          where: { id },
          data: { statusMessage: 'Downloading to our server 🎉' },
        });

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
  return new Promise<UploadApiResponse>((resolve, reject) => {
    console.log('Upload file to cloudinary');
    let uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'proto3d-models',
        resource_type: 'image',
      },
      (error, result) => {
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

// https://docs.sketchfab.com/data-api/v3/index.html#!/search/get_v3_search_type_models
const SEARCH_API = 'https://api.sketchfab.com/v3/search';
const MAX_FILE_SIZE = 10485760;

interface SearchModelsArg {
  searchQuery: string;
  cursor: number;
}
export async function searchModels({ searchQuery, cursor }: SearchModelsArg) {
  let { data: data1 } = await axios.get(SEARCH_API, {
    params: {
      type: 'models',
      downloadable: true,
      animated: false,
      sound: false,
      max_filesizes: `gltf:${MAX_FILE_SIZE}`,
      cursor,
      q: searchQuery,
    },
  });
  let { data: data2 } = await axios.get(SEARCH_API, {
    params: {
      type: 'models',
      downloadable: true,
      animated: false,
      sound: false,
      max_filesizes: `gltf:${MAX_FILE_SIZE}`,
      cursor: cursor + 24,
      q: searchQuery,
    },
  });

  let dataResults = [...data1.results, ...data2.results];

  // reformating
  let sketchfabModels: SketchfabModel[] = dataResults
    .filter((result: any) => result.archives.gltf.size < MAX_FILE_SIZE)
    .map((result: any) => {
      let images = result.thumbnails?.images;
      let [, imgSmall, imgLarge] = images.reverse();
      return {
        id: result.uid as string,
        name: result.name as string,
        sketchfabUrl: result.viewerUrl as string,
        imgSmall: imgSmall?.url as string,
        imgLarge: imgLarge?.url as string,
      };
    });

  let resultIds = sketchfabModels.map(model => model.id);
  let ourModels = await prisma.model.findMany({
    where: {
      OR: resultIds.map(id => ({ id })),
    },
  });

  let results = sketchfabModels.map(model => {
    let ourModel = ourModels.find(ourModel => ourModel.id === model.id);
    if (ourModel) {
      return { ...ourModel, ...model };
    }
    return {
      ...model,
      status: 'not-uploaded',
      statusMessage: 'Not uploaded to our server',
    };
  });

  return results;
}

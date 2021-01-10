export interface SketchfabModel {
  id: string;
  name: string;
  sketchfabUrl: string;
  imgSmall: string;
  imgLarge: string;
}

export type ModelStatus =
  | 'not-uploaded'
  | 'uploading'
  | 'uploaded'
  | 'error-while-uploading';

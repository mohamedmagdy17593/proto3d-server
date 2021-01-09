export interface SketchfabModel {
  id: string;
  name: string;
  sketchfabUrl: string;
  img: string;
}

export type ModelStatus =
  | 'not-uploaded'
  | 'uploading'
  | 'uploaded'
  | 'error-while-uploading';

import { atom } from 'recoil';

interface InputPrompt {
  prompt: string;
}

interface MediaData {
  type: string;
  data: any;
  // Add any other properties related to media data if needed
}

interface OutputData {
  text?: string;
  error?: string;
  inputPrompt?: InputPrompt;
  mediaData?: MediaData;
  socket:any
}

const outputAtom = atom<OutputData[]>({
  key: 'outputAtom',
  default: [],
});

export default outputAtom;
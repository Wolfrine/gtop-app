import type { AssistantApi } from './api.service';
import type { ReturnDetail } from './class-return-data';
import { markedCopy } from './class-return-pdf';

const chunkBytes = 400_000;
const maxResultBytes = 22_000_000;

function base64(bytes: Uint8Array) {
  let result = '';
  for (let offset = 0; offset < bytes.length; offset += 24_000) {
    const block = bytes.subarray(offset, offset + 24_000);
    result += String.fromCharCode(...block);
  }
  return btoa(result);
}

export async function publishStudentCopy(
  api: Pick<AssistantApi, 'request' | 'checkingImage' | 'user'>,
  id: string,
  version: number,
  onProgress: (message: string) => void = () => {},
) {
  const account = api.user?.uid;
  const checkActive = () => {
    if (!account || api.user?.uid !== account) throw Error('Your account changed. Reopen the submission.');
  };
  const target = '/staff/student-submissions/' + encodeURIComponent(id);
  const source = target + '/legacy-source';
  checkActive();
  onProgress('Preparing the marked PDF…');
  const detail = await api.request<ReturnDetail>(source);
  checkActive();
  const pdf = await markedCopy(detail, index => api.checkingImage(source + '/pages/' + index), checkActive);
  if (pdf.length > maxResultBytes) throw Error('The marked PDF exceeds 22 MB. Contact an administrator to return this copy.');
  const hashBytes = await crypto.subtle.digest('SHA-256', Uint8Array.from(pdf));
  checkActive();
  const sha = Array.from(new Uint8Array(hashBytes), byte => byte.toString(16).padStart(2, '0')).join('');
  const request = {version, sheetVersion: detail.sheet.version, size: pdf.length, sha};
  const count = Math.ceil(pdf.length / chunkBytes);
  for (let index = 0; index < count; index++) {
    checkActive();
    onProgress('Saving marked PDF… ' + (index + 1) + ' of ' + count);
    const from = index * chunkBytes;
    await api.request(target + '/result-chunks/' + index, 'POST', {
      ...request, data: base64(pdf.subarray(from, from + chunkBytes)),
    });
  }
  checkActive();
  onProgress('Releasing the checked copy…');
  await api.request(target + '/release', 'POST', request);
}

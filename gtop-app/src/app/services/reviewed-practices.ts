import type { ReviewedPractice } from './practice-invite.domain';

/** Exact source-backed revision pack; content review is not human teacher sign-off.
 * Full snapshots stay private. No answers or question text are published by this manifest.
 */
export const REVIEWED_PRACTICES: readonly ReviewedPractice[] = [{
  scope: { board: 'CBSE', standard: '12', subject: 'Chemistry', chapter: 'Solutions' },
  revision: 'cbse-12-chemistry-solutions-starter-5-2026-10-04',
  reviewEvidence: 'libfile_0197fc7810cc819185b47ed698d528ea',
  questionIds: ['0f0zI3fXrir2ZnQyI5Z2', '1qef7oUmRR9PctqAXnZ0', '21mBJNpFl2gRFWovQlnX', '4LmHaBe3xxegW5wrW1i6', '0EkMDD6A894FPaCqTsfE'],
  contentHashes: {
    '0f0zI3fXrir2ZnQyI5Z2': '210183fcf76ef35f9b50d79dabda5ab4ab9856355ae55210faa5c390186eb904',
    '1qef7oUmRR9PctqAXnZ0': 'f1c9635b735592af2ddee7802b3548be3088880bb88fb185bcf360a8ed9b87ae',
    '21mBJNpFl2gRFWovQlnX': 'a96bb846d13975195f0c8366f0ca52d73b2c5483f6f9618f5ac09cc57d5bef01',
    '4LmHaBe3xxegW5wrW1i6': '7346dc8fac462f2a6a89f3f011a9211f2f81aa54180e688e9582f98d7ca85a4a',
    '0EkMDD6A894FPaCqTsfE': '20806ea062503866f41ac2be410fe6444e62838e9b0e71886fc3360fbf9b4e6a'
  }
}];

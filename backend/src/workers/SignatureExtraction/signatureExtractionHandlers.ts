import logger from '../../utils/logger';

export interface SignatureExtractionData {
  type: 'email';
  userIdentifier: string;
  userId: string;
  userEmail: string;
  miningId: string;
  data: {
    body: string;
    seqNumber: number;
    folderPath: string;
    isLast: boolean;
  };
}
function extractSignature(body: string): string {
  const signatureMarkers = [
    '--',
    'Regards,',
    'Best regards,',
    'Cheers,',
    'Sent from my'
  ];

  for (const marker of signatureMarkers) {
    const markerIndex = body.lastIndexOf(marker);
    if (markerIndex !== -1) {
      return body.substring(markerIndex).trim();
    }
  }

  return '';
}

async function storeSignature(signature: string, metadata: any) {
  logger.debug('Storing signature', {
    signature,
    metadata
  });
}

async function signatureExtractionHandler(data: SignatureExtractionData) {
  const { userId, userEmail, miningId, data: emailData } = data;

  try {
    logger.debug('Processing signature extraction', {
      miningId,
      userEmail,
      seqNumber: emailData.seqNumber
    });

    const signature = extractSignature(emailData.body);

    await storeSignature(signature, {
      userId,
      miningId,
      seqNumber: emailData.seqNumber,
      folderPath: emailData.folderPath
    });

    return signature;
  } catch (error) {
    logger.error('Signature extraction failed', {
      error,
      miningId,
      userEmail,
      seqNumber: emailData.seqNumber
    });
    throw error;
  }
}

export default function initializeSignatureExtractionProcessor() {
  return {
    processStreamData: signatureExtractionHandler
  };
}

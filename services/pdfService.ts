/**
 * Service for extracting text from PDF files
 * Uses pdf.js for client-side PDF text extraction
 */

import * as pdfjsLib from 'pdfjs-dist';
import { ref, getBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

// Set up PDF.js worker - use unpkg.com which is more reliable for version 5.x
const workerVersion = pdfjsLib.version || '5.4.530';
// For pdfjs-dist 5.x, the worker file is pdf.worker.mjs (not .min.mjs)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${workerVersion}/build/pdf.worker.mjs`;

console.log(`📄 PDF.js worker configured: ${pdfjsLib.GlobalWorkerOptions.workerSrc} (version: ${workerVersion})`);

/**
 * Extracts text from a PDF file URL
 * @param pdfUrl - URL to the PDF file (Firebase Storage URL)
 * @returns Extracted text content or null if extraction fails
 */
export async function extractTextFromPDF(pdfUrl: string): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    console.log(`📄 Fetching PDF from: ${pdfUrl}`);
    
    let arrayBuffer: ArrayBuffer;
    
    // Try to extract the storage path from the URL and use Firebase SDK
    // Firebase Storage URLs look like: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}
    // The path is URL-encoded, so we need to decode it
    try {
      // Extract path from URL - match /o/... until ?
      const pathMatch = pdfUrl.match(/\/o\/(.+?)(?:\?|$)/);
      
      if (pathMatch && storage) {
        const encodedPath = pathMatch[1];
        const storagePath = decodeURIComponent(encodedPath);
        console.log(`📄 Using Firebase Storage SDK for path: ${storagePath}`);
        
        try {
          // Use getDownloadURL first - this gives us an authenticated URL
          const storageRef = ref(storage, storagePath);
          const downloadURL = await getDownloadURL(storageRef);
          
          // Fetch using the authenticated download URL (with timeout)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000);
          const response = await fetch(downloadURL, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
          }
          
          const blob = await response.blob();
          arrayBuffer = await blob.arrayBuffer();
          console.log(`✅ Successfully fetched PDF via authenticated download URL (${arrayBuffer.byteLength} bytes)`);
        } catch (sdkError: any) {
          // If getDownloadURL fails, try getBytes as fallback
          console.warn('getDownloadURL failed, trying getBytes:', sdkError);
          
          try {
            const storageRef = ref(storage, storagePath);
            const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Firebase Storage request timeout')), 60000)
            );
            
            const bytes = await Promise.race([
              getBytes(storageRef),
              timeoutPromise
            ]);

            // Firebase getBytes() may return either Uint8Array or ArrayBuffer depending on SDK typings/version.
            if (bytes instanceof ArrayBuffer) {
              arrayBuffer = bytes;
              console.log(`✅ Successfully fetched PDF via getBytes (${bytes.byteLength} bytes)`);
            } else {
              const u8 = bytes as Uint8Array;
              // Ensure we get a plain ArrayBuffer (not SharedArrayBuffer)
              arrayBuffer = u8.slice().buffer;
              console.log(`✅ Successfully fetched PDF via getBytes (${u8.byteLength} bytes)`);
            }
          } catch (bytesError: any) {
            // If it's a retry limit error, wait a bit and try once more
            if (bytesError?.code === 'storage/retry-limit-exceeded' || bytesError?.message?.includes('retry')) {
              console.warn('Firebase Storage retry limit exceeded, waiting 2s before retry...');
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              try {
                const storageRef = ref(storage, storagePath);
                const bytes = await getBytes(storageRef);
                if (bytes instanceof ArrayBuffer) {
                  arrayBuffer = bytes;
                  console.log(`✅ Successfully fetched PDF via getBytes on retry (${bytes.byteLength} bytes)`);
                } else {
                  const u8 = bytes as Uint8Array;
                  // Ensure we get a plain ArrayBuffer (not SharedArrayBuffer)
                  arrayBuffer = u8.slice().buffer;
                  console.log(`✅ Successfully fetched PDF via getBytes on retry (${u8.byteLength} bytes)`);
                }
              } catch (retryError) {
                console.error('All Firebase Storage methods failed:', retryError);
                throw retryError;
              }
            } else {
              console.error('getBytes also failed:', bytesError);
              throw bytesError;
            }
          }
        }
      } else {
        // Fallback to fetch if we can't parse the path or storage not available
        console.log(`📄 Using fetch() as fallback (could not parse Firebase path or storage not available)...`);
        const response = await fetch(pdfUrl, {
          mode: 'cors',
          credentials: 'omit'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        arrayBuffer = await blob.arrayBuffer();
      }
    } catch (fetchError) {
      console.error('Error fetching PDF:', fetchError);
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      console.error('Full error details:', {
        message: errorMessage,
        url: pdfUrl,
        error: fetchError
      });
      return {
        text: '',
        success: false,
        error: `Failed to fetch PDF: ${errorMessage}`
      };
    }
    
    // Check if the blob is actually a PDF
    const firstBytes = new Uint8Array(arrayBuffer.slice(0, 4));
    const isPDF = firstBytes[0] === 0x25 && firstBytes[1] === 0x50 && firstBytes[2] === 0x44 && firstBytes[3] === 0x46; // %PDF
    
    if (!isPDF) {
      return {
        text: '',
        success: false,
        error: 'File does not appear to be a valid PDF'
      };
    }
    
    // Extract text using PDF.js
    console.log(`📄 Extracting text from PDF using pdf.js...`);
    const text = await extractWithPDFJS(arrayBuffer);
    
    if (!text || text.trim().length === 0) {
      return {
        text: '',
        success: false,
        error: 'PDF appears to be empty or contains no extractable text'
      };
    }
    
    console.log(`✅ Successfully extracted ${text.length} characters from PDF`);
    return {
      text: text.trim(),
      success: true
    };
    
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return {
      text: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error extracting PDF text'
    };
  }
}

/**
 * Extracts text from PDF using pdf.js
 */
async function extractWithPDFJS(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const loadStart = Date.now();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const loadTime = ((Date.now() - loadStart) / 1000).toFixed(2);
    
    let fullText = '';
    const numPages = pdf.numPages;
    
    console.log(`📄 PDF loaded in ${loadTime}s, has ${numPages} pages, extracting text in parallel...`);
    
    // Extract text from all pages in parallel for faster processing
    const pagePromises = [];
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      pagePromises.push(
        pdf.getPage(pageNum).then(async (page) => {
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          return { pageNum, text: `\n--- Page ${pageNum} ---\n${pageText}\n` };
        })
      );
    }
    
    // Wait for all pages to be extracted in parallel
    const pageResults = await Promise.all(pagePromises);
    
    // Sort by page number and combine
    pageResults.sort((a, b) => a.pageNum - b.pageNum);
    fullText = pageResults.map(p => p.text).join('');
    
    const extractTime = ((Date.now() - loadStart) / 1000).toFixed(2);
    console.log(`✅ PDF text extraction completed in ${extractTime}s (${fullText.length} chars)`);
    
    return fullText;
  } catch (error) {
    console.error('Error in PDF.js extraction:', error);
    throw error;
  }
}

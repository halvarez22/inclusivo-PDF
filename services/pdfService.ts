// This uses the global pdfjsLib object loaded from the CDN in index.html
declare const pdfjsLib: any;

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs`;

export const extractTextFromPdf = async (file: File): Promise<string> => {
  const fileReader = new FileReader();

  return new Promise((resolve, reject) => {
    fileReader.onload = async (event) => {
      if (!event.target?.result) {
        return reject(new Error("Error al leer el archivo."));
      }

      try {
        const typedarray = new Uint8Array(event.target.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          fullText += pageText + "\n\n";
        }
        resolve(fullText.trim());
      } catch (error) {
        console.error("Error al procesar el PDF:", error);
        if (error instanceof Error) {
            if (error.name === 'PasswordException') {
                reject(new Error("El PDF está protegido con contraseña. Por favor, proporciona un archivo diferente."));
            } else {
                 reject(new Error("Error al procesar el archivo PDF. Podría estar corrupto o en un formato no compatible."));
            }
        } else {
            reject(new Error("Ocurrió un error desconocido al procesar el PDF."));
        }
      }
    };

    fileReader.onerror = () => {
      reject(new Error("Error al leer el archivo."));
    };

    fileReader.readAsArrayBuffer(file);
  });
};
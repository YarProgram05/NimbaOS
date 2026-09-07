import { google, type sheets_v4 } from 'googleapis'

let sheetsClient: sheets_v4.Sheets | null = null

function readServiceAccountJson() {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
  if (!encoded) {
    throw new Error('Google Sheets не настроен: задайте GOOGLE_SERVICE_ACCOUNT_JSON_BASE64')
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
  } catch {
    throw new Error('Google Sheets не настроен: GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 не является корректным JSON')
  }
}

export async function getGoogleSheetsClient(): Promise<sheets_v4.Sheets> {
  if (!sheetsClient) {
    const credentials = readServiceAccountJson()
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    sheetsClient = google.sheets({
      version: 'v4',
      auth,
    })
  }

  return sheetsClient
}

export async function getSpreadsheetMetadata(spreadsheetId: string) {
  const sheets = await getGoogleSheetsClient()
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'spreadsheetId,properties(title,locale,timeZone),sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)),merges)',
  })
  return response.data
}

export async function getSheetValues(
  spreadsheetId: string,
  range: string,
  valueRenderOption: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA' = 'FORMATTED_VALUE',
) {
  const sheets = await getGoogleSheetsClient()
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption,
  })
  return response.data.values ?? []
}

export async function batchUpdateSheetValues(
  spreadsheetId: string,
  data: Array<{ range: string; values: unknown[][] }>,
  valueInputOption: 'USER_ENTERED' | 'RAW' = 'USER_ENTERED',
) {
  if (data.length === 0) return
  const sheets = await getGoogleSheetsClient()
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption,
      data: data.map((item) => ({
        range: item.range,
        majorDimension: 'ROWS',
        values: item.values,
      })),
    },
  })
}

export async function batchUpdateSpreadsheet(
  spreadsheetId: string,
  requests: sheets_v4.Schema$Request[],
) {
  if (!requests.length) return
  const sheets = await getGoogleSheetsClient()
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
}

export async function clearSheetValues(spreadsheetId: string, ranges: string[]) {
  if (ranges.length === 0) return
  const sheets = await getGoogleSheetsClient()
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: { ranges },
  })
}

export async function copySheetRowPresentation(params: {
  spreadsheetId: string
  sheetId: number
  sourceRowNumber: number
  startRowNumber: number
  endRowNumber: number
}) {
  if (params.endRowNumber < params.startRowNumber) return
  const sheets = await getGoogleSheetsClient()
  const source = {
    sheetId: params.sheetId,
    startRowIndex: params.sourceRowNumber - 1,
    endRowIndex: params.sourceRowNumber,
  }
  const destination = {
    sheetId: params.sheetId,
    startRowIndex: params.startRowNumber - 1,
    endRowIndex: params.endRowNumber,
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: params.spreadsheetId,
    requestBody: {
      requests: [
        { copyPaste: { source, destination, pasteType: 'PASTE_FORMAT', pasteOrientation: 'NORMAL' } },
        { copyPaste: { source, destination, pasteType: 'PASTE_DATA_VALIDATION', pasteOrientation: 'NORMAL' } },
      ],
    },
  })
}

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
    fields: 'spreadsheetId,properties(title,locale,timeZone),sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))',
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
) {
  if (data.length === 0) return
  const sheets = await getGoogleSheetsClient()
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: data.map((item) => ({
        range: item.range,
        majorDimension: 'ROWS',
        values: item.values,
      })),
    },
  })
}

export async function clearSheetValues(spreadsheetId: string, ranges: string[]) {
  if (ranges.length === 0) return
  const sheets = await getGoogleSheetsClient()
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: { ranges },
  })
}

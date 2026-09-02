/**
 * index.js — Google Sheets integration barrel
 */

const googleSheetsService = require('./googleSheetsService');
const academicDataService = require('./academicDataService');
const { checkConfiguration } = require('./googleSheetsClient');
const errors = require('./errors');
const { SHEET_NAMES, COLUMNS, HEADERS } = require('./spreadsheetConfig');

module.exports = {
  googleSheetsService,
  academicDataService,
  checkConfiguration,
  errors,
  SHEET_NAMES,
  COLUMNS,
  HEADERS,
};

# Booking Fakturant

An Electron-based application for processing CSV booking exports into invoices on elektronickyuctovnik.sk.

## Installation

### Windows

1. Download the latest `InvoiceProcessor-x.x.x.exe` from the [Releases](../../releases) page
2. Create a folder called `InvoiceProcessor` where you want to run the application
3. Move the downloaded .exe file into this folder
4. Double-click the .exe to run it
5. The application will automatically create the following structure:
   ```
   InvoiceProcessor/
   ├── InvoiceProcessor-x.x.x.exe
   ├── config/
   │   ├── config.ini
   │   └── payload-template.json
   ├── data/
   │   ├── incoming/
   │   ├── processed/
   │   └── payloads/
   └── logs/
   ```

Note: The application is portable and doesn't require installation. You can move the folder anywhere on your system.

### Linux

1. Download the latest `InvoiceProcessor-x.x.x.AppImage` from the [Releases](../../releases) page
2. Create a folder called `InvoiceProcessor` where you want to run the application
3. Move the downloaded AppImage into this folder
4. Make the AppImage executable:
   ```bash
   chmod +x InvoiceProcessor-x.x.x.AppImage
   ```
5. Run the AppImage from within the folder:
   ```bash
   ./InvoiceProcessor-x.x.x.AppImage
   ```
6. The application will automatically create the same directory structure as shown above

Note: Like the Windows version, the Linux AppImage is also portable and can be moved anywhere on your system.

## Usage

1. **First Run**
   - On first run, the application will create all necessary directories and config files
   - Review and modify the `config/config.ini` file to set your API endpoint and other settings
   - Check the `config/payload-template.json` file to ensure the template matches your needs

2. **Processing Files**
   - Click "Add File" to select CSV files to process
   - Files will be copied to the `data/incoming` directory
   - Click "Load Data" to refresh the list of files to process
   - Select files and click "Process Selected Files" to generate invoices

3. **Output**
   - Processed files are moved to `data/processed`
   - Generated payloads are saved in `data/payloads`
   - Check the status list in the application for processing results

## Directory Structure

- `config/` - Configuration files
  - `config.ini` - Main configuration file
  - `payload-template.json` - Invoice template
- `data/` - Application data
  - `incoming/` - CSV files to be processed
  - `processed/` - Processed CSV files
  - `payloads/` - Generated JSON payloads
- `logs/` - Application logs

## Troubleshooting

1. **Application won't start**
   - Ensure you're running from within the InvoiceProcessor folder
   - Check logs in the `logs` directory
   - Make sure you have write permissions in the application folder

2. **Files not processing**
   - Check the `config.ini` file for correct API settings
   - Verify CSV file format matches expected structure
   - Check network connectivity for API access

3. **Moving the Application**
   - You can freely move the entire InvoiceProcessor folder
   - All data and settings are stored relative to the executable
   - Don't move just the executable without its folder structure

## Support

For issues and feature requests, please [open an issue](../../issues) on GitHub.

## License

ISC License - See LICENSE file for details
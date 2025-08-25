# IO8 Coder - VSCode-like Web IDE

A modern, web-based Integrated Development Environment (IDE) built with React, TypeScript, and FastAPI. This project provides a VSCode-like experience in your browser with features like file editing, code execution, and terminal access.

## 🚀 Features

- **Modern Web Interface**: Clean, responsive UI built with React and TypeScript
- **Code Editor**: Monaco Editor integration with syntax highlighting
- **File Management**: File explorer with create, edit, and delete capabilities
- **Code Execution**: Run code in multiple programming languages
- **Terminal**: Integrated terminal for command-line operations
- **AI Chat**: AI-powered coding assistance
- **Real-time Updates**: Live file synchronization and updates

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Monaco Editor** for code editing
- **XTerm.js** for terminal
- **Radix UI** for components

### Backend
- **FastAPI** (Python)
- **Uvicorn** for ASGI server
- **Pydantic** for data validation

## 📁 Project Structure

```
io8-coder/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── workspace/          # User workspace files
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── lib/           # Utility libraries
│   │   └── utils/         # Helper functions
│   ├── package.json       # Node.js dependencies
│   └── vite.config.ts     # Vite configuration
├── README.md              # This file
├── .gitignore            # Git ignore rules
└── How to run.txt        # Quick start guide
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.8+**
- **Node.js 16+**
- **npm** or **yarn**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/io8-coder.git
   cd io8-coder
   ```

2. **Set up the Backend**
   ```bash
   cd backend
   python -m venv .venv
   
   # On Windows (PowerShell)
   .\.venv\Scripts\Activate.ps1
   
   # On macOS/Linux
   source .venv/bin/activate
   
   pip install -r requirements.txt
   uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```

3. **Set up the Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000

## 📖 Usage

1. **File Management**: Use the file explorer to create, edit, and manage files
2. **Code Editing**: Write and edit code with syntax highlighting
3. **Code Execution**: Run your code directly in the browser
4. **Terminal**: Access command-line tools through the integrated terminal
5. **AI Assistance**: Get help with your code through the AI chat feature

## 🔧 Development

### Backend Development
- The backend is built with FastAPI and provides RESTful APIs
- File operations are sandboxed to the workspace directory
- Supports multiple programming languages for code execution

### Frontend Development
- Built with React and TypeScript for type safety
- Uses Vite for fast development and building
- Styled with Tailwind CSS for consistent design

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the code editor
- [XTerm.js](https://xtermjs.org/) for the terminal
- [Radix UI](https://www.radix-ui.com/) for accessible components
- [Tailwind CSS](https://tailwindcss.com/) for styling

## 📞 Support

If you have any questions or need help, please open an issue on GitHub.

---

**Made by IO8 Coder Team**


import axios from 'axios';
import { v4 as uuidv4 } from "uuid";
let kernelID = '';
let sessionID = '';
let socket: WebSocket | undefined = undefined;


interface SessionData {
  kernel: { id: string };
  id: string;
}

type Headers = Record<string, string>;

const token = import.meta.env.VITE_JUPYTER_TOKEN
const base = import.meta.env.VITE_JUPYTER_SERVER_BASE_URL
const ws_url = import.meta.env.VITE_JUPYTER_WS_URL

const headers: Headers = {
  Authorization: `token ${token}`,
  "Content-Type": "application/json"
};



export const createSession = async (): Promise<object> => {
  try {
    const userId = uuidv4();
    const response = await axios.post<SessionData>(
      `${base}/api/sessions`,
      {
        kernel: { name: 'python3' },
        path: `${userId}_file.ipynb`,
        type: 'notebook'
      },
      { headers }
    );
    const data = response.data;
    kernelID = data.kernel.id;
    sessionID = data.id;
    return data;
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Failed to create session');
  }
};

interface WebSocketEventMap {
  close: CloseEvent;
  error: ErrorEvent;
  message: MessageEvent;
  open: Event;
}

type WebSocketEventHandler<K extends keyof WebSocketEventMap> = (event: WebSocketEventMap[K]) => void;

interface WebSocket extends EventTarget {
  onclose?: WebSocketEventHandler<'close'> | null;
  onerror?: WebSocketEventHandler<'error'> | null;
  onmessage?: WebSocketEventHandler<'message'> | null;
  onopen?: WebSocketEventHandler<'open'> | null;
  close(code?: number, reason?: string): void;
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
  readonly CLOSED: number;
  readonly CLOSING: number;
  readonly CONNECTING: number;
  readonly OPEN: number;
}

type HandleMediaDataFunction = (data: Record<string, unknown>) => void;
type HandleTextOutputFunction = (data?: string, error?: object, isConsole?: boolean) => void;
type HandleInputFunction = (data: object) => void;

export const connectToKernel = (kernelId: string, sessionId: string, setSocket: React.Dispatch<React.SetStateAction<WebSocket>>, pythonCode: string, handleTextOutput: HandleTextOutputFunction, handleMediaData: HandleMediaDataFunction, handleInputData: HandleInputFunction, isConsole: boolean): void => {
  console.log("Connect to kernel", kernelId, sessionId);
  if (kernelId && sessionId) {
    const wsUrl = `${ws_url}/api/kernels/${kernelId}/channels?session_id=${sessionId}`;
    const conn = new WebSocket(wsUrl);
    // console.log(conn);
    setSocket(conn);
    socket = conn;
    socket.onopen = function () {
      executeCode(pythonCode, handleTextOutput, handleMediaData, handleInputData, isConsole);
    }
  }
};



const recv_all = (conn: WebSocket, handleTextOutput: HandleTextOutputFunction, handleMediaData: HandleMediaDataFunction, handleInputData: HandleInputFunction, isConsole: boolean): void => {
  let cnt = 0;
  const isCon = isConsole
  const loops = setInterval(() => {
    try {
      conn.onmessage = function (res: MessageEvent) {
        cnt = 0;
        const data = res.data;
        const msg = JSON.parse(data);
        // console.log(msg);
        if (msg.msg_type === "input_request") {
          console.log("input request", msg.content);
          handleInputData(msg)
        }
        if (msg?.content?.text) {
          const newOutput = msg.content.text;
          console.log(newOutput, "txtt");
          handleTextOutput(msg?.content?.text, undefined, isCon)
        }
        if (msg?.content?.status === "error") {
          // console.log(isCon,"errrr");
          handleTextOutput(undefined, msg, isCon)
        }
        if (msg?.content?.data) {
          const data = msg?.content?.data
          // console.log("data", Object.keys(data).length)
          if (Object.keys(data).length == 1) {
            handleTextOutput(data["text/plain"], undefined, isCon)
          }
          else {
            handleMediaData(data);
          }
        }
        // console.log(` type: type: ${msg.msg_type}, content: ${JSON.stringify(msg.content)}`);
      };
    } catch (e) {
      console.log(e);
    }
    cnt += 10;
  }, 10);
  if (cnt === 1000) {
    clearInterval(loops);
  }
};

export const executeCode = (pythonCode: string, handleTextOutput: HandleTextOutputFunction, handleMediaData: HandleMediaDataFunction, handleInputData: HandleInputFunction, isConsole: boolean): void => {
  const codeMsg = {
    channel: "shell",
    content: { silent: false, code: pythonCode, allow_stdin: true, allow_traceback: true },
    header: { msg_id: uuidv4(), msg_type: "execute_request" },
    metadata: {},
    parent_header: {},
  };

  if (socket) {
    console.log("Receiving initial messages\n", isConsole);
    // console.log(socket)
    recv_all(socket, handleTextOutput, handleMediaData, handleInputData, isConsole);
    console.log("\nSending execute_request\n");
    socket.send(JSON.stringify(codeMsg));
    console.log("Receiving execute_reply\n");
    recv_all(socket, handleTextOutput, handleMediaData, handleInputData, isConsole);

    socket.onerror = function (error:ErrorEvent) {
      console.error("WebSocket Error: ", error);
    };
    socket.onclose = function () {
      console.log("WebSocket connection closed");
    };
  }


};

export const deleteKernel = () => {
  fetch(`${base}/api/kernels/${kernelID}`, {
    method: "DELETE",
    headers
  })
    .then((response) => { if (response.status == 204) console.log('kernel deleted successfully') })
    .catch((error) => console.error("Error:", error));
}

export const interruptKernel = () => {
  fetch(`${base}/api/kernels/${kernelID}/interrupt`, {
    method: "POST",
    headers
  })
    .then((response) => { if (response.status == 204) console.log('kernel interrupted ') })
    .catch((error) => console.error("Error:", error));
}
export const restartKernel = () => {
  fetch(`${base}/api/kernels/${kernelID}/restart`, {
    method: "POST",
    headers
  })
    .then((response) => { if (response.status == 204) console.log('kernel restarted successfully') })
    .catch((error) => console.error("Error:", error));
}

export const deletSession = () => {

}

export const sendInput = (input:string) => {
  if (socket)
    socket.send(JSON.stringify(input))
}

export const handleTabClose = async (): Promise<void> => {
  try {
    await deleteSession();
  } catch (error) {
    console.error('Error:', error);
  }
};

export const deleteSession = async (): Promise<void> => {
  try {
    // alert("Delete the session")
    if (sessionID) {
      await axios.delete(`${base}/api/sessions/${sessionID}`, { headers });
      console.log('Session deleted successfully');
    }
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Failed to delete session');
  }
};
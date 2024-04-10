import { DockviewReact, DockviewReadyEvent } from "dockview";
import React, { useState, useEffect, useRef } from "react";
import AceEditor from "react-ace";
import InteractiveShell from "./ReactTerminal";
import {
  connectToKernel,
  createSession,
  interruptKernel,
  executeCode,
} from "../api/jupyter-server";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/theme-monokai";

import { useRecoilState } from "recoil";
import outputAtom from "../state/atom";

const DockLayout: React.FC = (props: { theme?: string }) => {
  const [code, setCode] = useState("# Write your Python code here");
  const [session, setSession] = useState(false);
  const [kernelId, setKernelId] = useState(undefined);
  const [sessionId, setSessionId] = useState(undefined);
  const [socket, setSocket] = useState(undefined);
  const [mediaData, setMediaData] = useState([]);
  const [output, setOutput] = useRecoilState(outputAtom);
  const editorRef = useRef(null);

  const listRef = useRef(null);

  const handleMediaData = (data:object) => {
    // console.log(data);
    setMediaData((prev) => [...prev, data["image/png"]]);
    console.log(mediaData);
    // Create a new li element and append it to the listRef
    const li = document.createElement("li");
    li.innerHTML = `
        <div>
          <h1>Image ${mediaData.length + 1}</h1>
          <img src="data:image/png;base64, ${data["image/png"]}" alt="Output" />
        </div>
      `;
    listRef?.current?.appendChild(li);
  };

  const getEditorInstance = (editor:any) => {
    console.log(editor);
    if (editor) {
      editorRef.current = editor;
    }
  };

  const handleInputData = (msg: any) => {
    setOutput((prevOutput) => [
      ...prevOutput,
      { inputPrompt: msg?.content?.prompt },
    ]);
  };

  const handleTextOutput = (msg: string, err: object, isConsole: boolean) => {
    if (msg) {
      // const newOutput = msg.content.text;
      setOutput((prevOutput) => [...prevOutput, { text: msg }]);
    } else if (err) {
      const traceback = err.content.traceback;

      let errorLine = undefined;
      if (traceback && traceback.length > 1) {
        const lines = traceback[2].split(" ");
        errorLine = lines[3].match(/^\d+(?=\D)/);
      }
      if (errorLine && errorLine[0]) {
        const lineNumber = parseInt(errorLine[0]);
        if (editorRef.current && !isConsole) {
          // console.log(isConsole)
          editorRef.current.gotoLine(lineNumber, 0, true);
          editorRef.current.getSession().setAnnotations([
            {
              row: lineNumber - 1,
              column: 5,
              text: err.content.ename + ": " + err.content.evalue,
              type: "error",
            },
          ]);
          setOutput((prevOutput) => [
            ...prevOutput,
            {
              error:
                "At line " +
                lineNumber +
                ", " +
                err.content.ename +
                ": " +
                err.content.evalue +
                "\n",
            },
          ]);
        } else
          setOutput((prevOutput) => [
            ...prevOutput,
            { error: err.content.ename + ": " + err.content.evalue + "\n" },
          ]);
      } else {
        setOutput((prevOutput) => [
          ...prevOutput,
          { error: err.content.ename + ": " + err.content.evalue + "\n" },
        ]);
      }
    }
  };

  const runCode = async () => {
    editorRef?.current?.getSession()?.clearAnnotations();
    if (!session) {
      try {
        const sessionResponse = await createSession();
        setKernelId(sessionResponse.kernel.id);
        setSessionId(sessionResponse.id);
        setSession(true);
      } catch (err) {
        console.log(err);
      }
    } else if (!socket) {
      console.log(code);
      kernelConnection();
    } else {
      executeCode(
        code,
        handleTextOutput,
        handleMediaData,
        handleInputData,
        false
      );
    }
  };

  useEffect(() => {
    if (socket) {
      setOutput((prevOutput) => [...prevOutput, { socket: socket }]);
    }
  }, [socket]);

  const kernelConnection = async () => {
    if (session) {
      connectToKernel(
        kernelId,
        sessionId,
        setSocket,
        code,
        handleTextOutput,
        handleMediaData,
        handleInputData,
        false
      );
    }
  };

  useEffect(() => {
    if (session) {
      (async () => {
        console.log("session true ");
        kernelConnection();
      })();
    }
  }, [session]);

  const components = {
    iframeComponent: () => {
      return (
        <AceEditor
          onLoad={getEditorInstance}
          mode="python"
          theme="chaos"
          style={{ background: "var(--dv-group-view-background-color)" }}
          onChange={(newValue) => {
            setCode(newValue);
            editorRef?.current?.getSession()?.clearAnnotations();
          }}
          name="script-py-editor"
          fontSize={14}
          // showPrintMargin={true}
          showGutter={true}
          highlightActiveLine={true}
          value={code}
          height="100%"
          width="100%"
          setOptions={{
            enableBasicAutocompletion: false,
            enableLiveAutocompletion: false,
            enableSnippets: false,
            showLineNumbers: true,
            tabSize: 4,
          }}
        />
      );
    },
    PythonShell: () => {
      return (
        <div
          style={{
            height: "100%",
            background: "var(--dv-group-view-background-color)",
          }}
        >
          <InteractiveShell
            handleTextOutput={handleTextOutput}
            handleInputData={handleInputData}
            handleMediaData={handleMediaData}
          />
        </div>
      );
    },
    MediaComponent: (mediaData) => {
      console.log(mediaData);

      return (
        <div style={{ height: "100%", color: "white" }}>
          <div
            style={{
              height: "100%",
              color: "white",
              overflow: "auto",
            }}
          >
            <ul className="list-disc pl-8" ref={listRef}></ul>
          </div>
        </div>
      );
    },
  };
  const onReady = (event: DockviewReadyEvent) => {
    event.api.addPanel({
      id: "script.py",
      component: "iframeComponent",
      renderer: "always",
    });

    event.api.addPanel({
      id: "IPython Shell",
      component: "PythonShell",
      position: {
        direction: "right",
      },
      renderer: "always",
    });

    event.api.addPanel({
      id: "Media",
      component: "MediaComponent",
      position: {
        referencePanel: "IPython Shell",
        direction: "below",
      },
      renderer: "always",
    });
  };

  return (
    <>
      <DockviewReact
        components={components}
        onReady={onReady}
        className={`${props.theme || "dockview-theme-abyss"} h-[90%]`}
      />

      <div className="border p-2  shadow-md min-h-[50px]">
        <button
          className="shadow-[0_4px_14px_0_rgba(0,255,76,0.4)] hover:shadow-[0_6px_20px_rgba(0,255,76,0.25)] hover:bg-[rgba(0,255,76,0.81)] px-8 py-2 bg-[#00f351] rounded-md text-white font-light transition duration-200 ease-linear"
          onClick={runCode}
        >
          RUN
        </button>
        <button
          className="shadow-[0_4px_14px_0_rgba(0,255,76,0.4)] hover:shadow-[0_6px_20px_rgba(0,255,76,0.25)] hover:bg-[rgba(0,255,76,0.81)] px-8 py-2 bg-[#00f351] rounded-md text-white font-light transition duration-200 ease-linear"
          onClick={interruptKernel}
        >
          Interrupt
        </button>
      </div>
    </>
  );
};

export default DockLayout;

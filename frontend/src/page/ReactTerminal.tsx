import React, { useEffect, useState, useRef } from "react";
import Terminal, { ColorMode, TerminalOutput } from "react-terminal-ui";
import { useRecoilValue, useRecoilState } from "recoil";
import outputAtom from "../state/atom";
import { v4 as uuidv4 } from "uuid";
import { executeCode, sendInput } from "../api/jupyter-server";

const InteractiveShell: React.FC<any> = ({
  handleTextOutput,
  handleInputData,
  handleMediaData,
}) => {
  const output = useRecoilValue(outputAtom);
  const [outputss, setOutputs] = useState(output);
  const terminalDivRef = useRef();

  const [prompt, setPrompt] = useState(">>>");
  const [needInput, setInputNeed] = useState(false);
  const [isConsoleWaiting, setConsoleWaiting] = useState(false);

  const handleInput = (input: string) => {
    setConsoleWaiting(true);
    const newDiv = document.createElement("div");
    // console.log(prompt)
    newDiv.innerHTML =
      `<span style='color: gray; padding:2px;'> ${
        needInput ? `In: ${prompt}` : ">>> "
      } </span>` + input!;
    terminalDivRef.current.appendChild(newDiv);
    setPrompt("");

    if (needInput) {
      const input_msg = {
        channel: "stdin",
        content: { value: input, status: "ok" },
        header: { msg_id: uuidv4(), msg_type: "input_reply" },
        metadata: {},
        parent_header: {},
      };
      sendInput(input_msg);
      setInputNeed(false);
    } else if (input) {
      executeCode(
        input,
        handleTextOutput,
        handleMediaData,
        handleInputData,
        true
      );
    }
    setConsoleWaiting(false);
    if (!needInput || !isConsoleWaiting) setPrompt(">>>");
  };

  useEffect(() => {
    const len = output.length;
    console.log(output);
    if (output && len > 0) {
      if (output[len - 1].text) {
        // console.log("aldf;alkd;freact terminal ", output);
        const lastOutput = output[len - 1].text;
        const newDiv = document.createElement("div");
        newDiv.innerHTML =
          "<span style='color: gray; padding:2px;'>Out: </span>" + lastOutput!;
        terminalDivRef.current.appendChild(newDiv);
      } else if (output[len - 1].error) {
        const lastOutput = output[len - 1].error;
        const newDiv = document.createElement("div");
        newDiv.style.color = "red";
        newDiv.innerHTML =
          "<span style='color: gray; padding:2px; '>Out[]: </span>" +
          lastOutput!;
        terminalDivRef.current.appendChild(newDiv);
      } else if (output[len - 1].inputPrompt) {
        setConsoleWaiting(false);
        console.log(output[len - 1].inputPrompt);
        setPrompt(output[len - 1].inputPrompt);
        setInputNeed(true);
      }

      setOutputs([]);
    }
  }, [output]);

  return (
    <div className="h-[100%] overflow-auto">
      <Terminal
        // name='python shell'
        colorMode="light"
        onInput={
          !isConsoleWaiting
            ? (terminalInput) => {
                handleInput(terminalInput);
              }
            : null
        }
        height="100%"
        prompt={prompt}
      >
        <div ref={terminalDivRef}></div>
      </Terminal>
    </div>
  );
};

export default InteractiveShell;

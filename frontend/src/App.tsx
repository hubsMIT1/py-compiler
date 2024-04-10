import DockLayout from './page/DockLayout'
import 'dockview/dist/styles/dockview.css';
import { handleTabClose } from './api/jupyter-server'

function App() {
  window.addEventListener('beforeunload', async () => {
    await handleTabClose();
  });

  window.addEventListener('beforeunload', async (event) => {
    event.preventDefault(); 
    await handleTabClose(); 
  });
  return (
    <>
    <DockLayout />
    </>
  )
}
export default App

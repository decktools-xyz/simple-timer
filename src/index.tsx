import {
  Button,
  ButtonItem,
  ButtonProps,
  ConfirmModal,
  Focusable,
  PanelSection,
  PanelSectionRow,
  showModal,
  staticClasses,
  ToggleField
} from "@decky/ui";

import {
  addEventListener,
  removeEventListener,
  callable,
  definePlugin,
  toaster,
} from "@decky/api";

import { FaClock, FaMinus, FaPlus, FaVolumeDown } from "react-icons/fa";
import { PropsWithChildren, useEffect, useState } from "react";
import { SteamUtils } from "./utils/steam";

// This function calls the python function "start_timer", which takes in no arguments and returns nothing.
// It starts a (python) timer which eventually emits the event 'timer_event'
const startTimer = callable<[seconds: number], void>("start_timer");
const cancelTimer = callable<[void], void>("cancel_timer");
const saveSubtleMode = callable<[subtle: boolean], void>("set_subtle_mode");

// This function opens a given URL in the browser
const loadRecents = callable<[void], void>("load_recents");
const loadSecondsRemaining = callable<[void], void>("load_remaining_seconds");
const loadSubtleMode = callable<[void], boolean>("load_subtle_mode");

type MinutesButtonProps = PropsWithChildren<ButtonProps & { type: 'positive' | 'negative' }>;

const MinutesButton = ({ children, type, ...props }: MinutesButtonProps) => {
  const disabled = props.disabled;

  const colorStyles: React.CSSProperties = disabled ?
    { backgroundColor: '#00000044', color: '#aaaaaa' } :
    { backgroundColor: type === 'positive' ? '#44aa44' : '#aa4444', color: '#ffffff' };

  return (
    <Button disabled={disabled} preferredFocus style={{
      display: 'flex',
      fontSize: 18,
      flexDirection: 'row',
      gap: 4,
      alignItems: 'center',
      padding: 8,
      paddingTop: 2,
      paddingBottom: 2,
      borderRadius: 8,
      border: 0,
      ...colorStyles
    }} {...props}>
      {children}
    </Button>
  )
}

const directoryPath = import.meta.url.substring(0, import.meta.url.lastIndexOf('/') + 1);

function Content() {
  const [timerMinutes, setTimerMinutes] = useState(5);

  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [recentTimerSeconds, setRecentTimerSeconds] = useState<number[] | null>();
  const [subtleMode, setSubtleMode] = useState<boolean>(false);

  useEffect(() => {
    const handleRefreshRecents = (recents: number[]) => {
      setRecentTimerSeconds(recents);
    };

    const handleSecondsRemaining = (seconds: number) => {
      setSecondsRemaining(seconds);
    };

    const handleSubtleModeUpdate = (subtle: boolean) => {
      setSubtleMode(subtle);
    }

    addEventListener<[seconds: number]>("simple_timer_seconds_updated", handleSecondsRemaining);
    addEventListener<[recents: number[]]>("simple_timer_refresh_recents", handleRefreshRecents);
    addEventListener<[subtle: boolean]>("simple_timer_subtle", handleSubtleModeUpdate);

    loadRecents();
    loadSecondsRemaining();
    loadSubtleMode();

    return () => {
      removeEventListener("simple_timer_refresh_recents", handleRefreshRecents);
      removeEventListener("simple_timer_seconds_updated", handleSecondsRemaining);
      removeEventListener("simple_timer_subtle", handleSubtleModeUpdate);
    }
  }, []);

  return (
    <>
      <PanelSection>
        {secondsRemaining <= 0 ? (
          <PanelSectionRow>
            <Focusable preferredFocus flow-children="row" style={{ display: 'flex', flex: '1 1 auto', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              <MinutesButton type='positive' onClick={() => setTimerMinutes(prev => prev + 5)}>
                <FaPlus size={8} /><span>5</span>
              </MinutesButton>
              <MinutesButton type='positive' onClick={() => setTimerMinutes(prev => prev + 10)}>
                <FaPlus size={8} /><span>10</span>
              </MinutesButton>
              <MinutesButton type='positive' onClick={() => setTimerMinutes(prev => prev + 30)}>
                <FaPlus size={8} /><span>30</span>
              </MinutesButton>
            </Focusable>
          </PanelSectionRow>
        ) : null}

        <PanelSectionRow>
          {secondsRemaining > 0 ? (
            <>
              <ButtonItem onClick={async () => await cancelTimer()} bottomSeparator="none" layout="below">
                Cancel Timer<br />
                (&lt; {`${Math.round(secondsRemaining / 60)} minute${secondsRemaining > 60 ? 's' : ''}`})
              </ButtonItem>
            </>
          ) : (
            <ButtonItem onClick={async () => await startTimer(timerMinutes * 60)} bottomSeparator="none" layout="below">Begin Timer<br />({timerMinutes} minutes)</ButtonItem>
          )}
        </PanelSectionRow>

        {secondsRemaining <= 0 ? (
          <PanelSectionRow>
            <Focusable preferredFocus flow-children="row" style={{ display: 'flex', paddingBottom: 16, flex: '1 1 auto', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              <MinutesButton type='negative' disabled={timerMinutes <= 5} onClick={() => setTimerMinutes(prev => prev - 5)}>
                <FaMinus size={8} /><span>5</span>
              </MinutesButton>
              <MinutesButton type='negative' disabled={timerMinutes <= 10} onClick={() => setTimerMinutes(prev => prev - 10)}>
                <FaMinus size={8} /><span>10</span>
              </MinutesButton>
              <MinutesButton type='negative' disabled={timerMinutes <= 30} onClick={() => setTimerMinutes(prev => prev - 30)}>
                <FaMinus size={8} /><span>30</span>
              </MinutesButton>
            </Focusable>
          </PanelSectionRow>
        ) : null}

        <PanelSectionRow>
          <ToggleField
            disabled={secondsRemaining > 0}
            icon={<FaVolumeDown />}
            checked={subtleMode}
            label="Subtle Mode"
            description="You will be presented with a small toast instead of a fullscreen popup."
            onChange={(newVal: boolean) => {
              saveSubtleMode(newVal);
            }}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Recent Timers" spinner={!recentTimerSeconds}>
        <PanelSectionRow>
          {recentTimerSeconds?.length === 0 ? (
            <p>You have no recent timers. You can quickly restart your last 5 timers here.</p>
          ) : (
            recentTimerSeconds?.map((seconds, idx) => (
              <ButtonItem disabled={secondsRemaining > 0} layout="below" key={`${idx}-seconds`} onClick={async () => startTimer(seconds)}>Start {seconds / 60} Minute Timer</ButtonItem>
            ))
          )}
        </PanelSectionRow>
      </PanelSection>

      <PanelSection>
        <PanelSectionRow>
          <ButtonItem disabled bottomSeparator="none" layout="below">decktools.xyz/donate <span style={{ color: 'pink' }}>&lt;3</span></ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
};

export default definePlugin(() => {
  const handleTimerComplete = (message:string, subtle: boolean) => {
    const Alarm = () => <audio src={directoryPath + 'alarm.mp3'} autoPlay />;
    
    (window.document.getElementById('alarm-sound') as HTMLAudioElement)?.play();

    if (subtle) {
      toaster.toast({
        title: message,
        body: "Your timer has finished."
      })
    } else {
      showModal(<ConfirmModal 
          children={<Alarm />}
          strTitle={message} 
          strDescription="Your timer has finished. You can either suspend now, or ignore the alert." 
          strOKButtonText="Suspend Now"
          strCancelButtonText="Ignore"
          onOK={async () => await SteamUtils.suspend()}
      />);
    }
  }

  addEventListener<[message: string, subtle: boolean]>("simple_timer_event", handleTimerComplete);

  return {
    name: "Simple Timer",
    titleView: <div className={staticClasses.Title}>Simple Timer</div>,
    content: <Content />,
    icon: <FaClock />,
    onDismount: () => removeEventListener("simple_timer_event", handleTimerComplete),
  };
});

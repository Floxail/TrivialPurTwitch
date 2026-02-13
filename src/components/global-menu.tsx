import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Changelog from './changelog';
import Help from './help';
import { useAuthStore } from './store/auth-store';
import { usePlayerStore } from './store/player-store';
import { useSettingsStore } from './store/settings-store';

const GlobalMenu = () => {
  const navigate = useNavigate();
  const twitchAvatar = useAuthStore((state) => state.twitchAvatar);


  const settingsStore = useSettingsStore();
  const authStore = useAuthStore();
  const clearPlayers = usePlayerStore((state) => state.clear);

  const [helpDisplayed, setHelpDisplayed] = useState(false);
  const [changelogDisplayed, setChangelogDisplayed] = useState(false);

  const onSettingsClick = () => {
    navigate('/settings');
  };

  const onSwitchThemeClick = () => {
    settingsStore.toggleTheme();
  };

  const onHelpClick = () => {
    setHelpDisplayed(true);
  };

  const onChangelogClick = () => {
    setChangelogDisplayed(true);
  };

  const onLogoutClick = () => {
    clearPlayers();
    authStore.clear();
    settingsStore.reset();
    navigate('/');
  };

  const CustomToggle = React.forwardRef<HTMLDivElement, { onClick: (e: React.MouseEvent<HTMLDivElement>) => void }>(
    ({ onClick }, ref) => (
      <div ref={ref} onClick={(e) => {
        e.preventDefault();
        onClick(e);
      }} style={{ fontSize: 'large', backgroundColor: 'var(--global-menu-color)', borderRadius: '35px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
        <FontAwesomeIcon icon={['fas', 'bars']} style={{ margin: '0 0.5rem 0 0.75rem', verticalAlign: 'middle' }} />
        <img src={twitchAvatar} style={{ height: '35px', width: '35px', borderRadius: '50%', objectFit: 'cover' }} alt="Avatar" />
      </div>
    ),
  );

  return (
    <>
      <Dropdown style={{ display: 'inline-block' }} className="mx-2">
        <Dropdown.Toggle as={CustomToggle} />
        <Dropdown.Menu>
          <Dropdown.Item as="button" onClick={() => navigate('/questions')}><FontAwesomeIcon icon={['fas', 'question']} size="lg" /> Questions</Dropdown.Item>
          <Dropdown.Item as="button" onClick={onSettingsClick}><FontAwesomeIcon icon={['fas', 'cog']} size="lg" /> Settings</Dropdown.Item>
          <Dropdown.Item as="button" onClick={(e) => {
            e.stopPropagation();
            onSwitchThemeClick();
          }}><FontAwesomeIcon icon={['fas', 'adjust']} size="lg" /> Switch theme</Dropdown.Item>
          <Dropdown.Item as="button" onClick={onHelpClick}><FontAwesomeIcon icon={['fas', 'question-circle']} size="lg" /> Help</Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item as="button" onClick={onChangelogClick}><FontAwesomeIcon icon={['fas', 'book']} size="lg" /> Changelog</Dropdown.Item>
          <Dropdown.Item as="button"><a style={{ color: 'inherit' }} href="https://ko-fi.com/floxail" target="_blank" rel="noreferrer"><FontAwesomeIcon icon={['fas', 'heart']} color="red" size="lg" /> Support me</a></Dropdown.Item>
          <Dropdown.Item as="button" onClick={onLogoutClick}><FontAwesomeIcon icon={['fas', 'sign-out-alt']} size="lg" /> Logout</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      <Help show={helpDisplayed} onClose={() => setHelpDisplayed(false)} />
      <Changelog show={changelogDisplayed} onClose={() => setChangelogDisplayed(false)} />
    </>
  );
};

export default GlobalMenu;
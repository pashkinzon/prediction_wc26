import type { FormEvent } from 'react';
import type { User } from '../types';

type UserSwitcherProps = {
  currentNickname: string;
  users: User[];
  newNickname: string;
  onNewNicknameChange: (value: string) => void;
  onAddUser: (nickname: string) => void;
  onSwitchUser: (nickname: string) => void;
};

export function UserSwitcher({
  currentNickname,
  users,
  newNickname,
  onNewNicknameChange,
  onAddUser,
  onSwitchUser,
}: UserSwitcherProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddUser(newNickname);
  }

  return (
    <section className="panel user-panel">
      <div>
        <p className="eyebrow">Private game</p>
        <h1>World Cup 2026 Predictor</h1>
      </div>
      <div className="user-controls">
        <label>
          Switch user
          <select
            value={currentNickname}
            onChange={(event) => onSwitchUser(event.target.value)}
          >
            <option value="">Choose nickname</option>
            {users.map((user) => (
              <option key={user.nickname} value={user.nickname}>
                {user.nickname}
              </option>
            ))}
          </select>
        </label>
        <form onSubmit={handleSubmit} className="nickname-form">
          <label>
            Add nickname
            <input
              type="text"
              value={newNickname}
              onChange={(event) => onNewNicknameChange(event.target.value)}
              placeholder="e.g. Pasha"
              maxLength={24}
            />
          </label>
          <button type="submit">Use</button>
        </form>
      </div>
    </section>
  );
}

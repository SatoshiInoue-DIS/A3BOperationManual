import { useMsal } from "@azure/msal-react";
import { useEffect } from "react";

const Logout = () => {
  const { instance } = useMsal();

  useEffect(() => {
    // ログアウト後に自動的にログイン画面を表示
    instance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin, // サインアウト後、元のURLへ戻る
    });
  }, [instance]);

  return <p>Logging out...</p>;
};

export default Logout;
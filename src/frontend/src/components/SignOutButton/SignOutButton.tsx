import { useMsal } from "@azure/msal-react";

import styles from "./SignoutButton.module.css"
import { LogOut } from "../../api/api"

const SignOutButton = () => {
    const { instance } = useMsal();
    
    const handleLogout = async () => {
      // 1. バックエンドのセッションをクリア
      await LogOut;
      // 2. フロントエンドのMSAL.jsでサインアウト処理
      instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin,
      });
    };

  return (
    <div className={styles.signout_btn} onClick={handleLogout}>サインアウト</div>
  )
};

export default SignOutButton;
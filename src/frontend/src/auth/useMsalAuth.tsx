import { useState, useEffect } from "react";
import { msalInstance } from "./msalConfig";
import { AuthenticationResult, EventType } from "@azure/msal-browser";
import { useNavigate } from "react-router-dom";

export const useMsalAuth = () => {
    const [loginUser, setLoginUser] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const initializeMsal = async () => {
            try {
                await msalInstance.initialize();
            } catch (error) {
            }
        };
        const handleLogin = async () => {
            try {
                // MSALインスタンスの初期化を待つ
                await initializeMsal();
                // 1. handleRedirectPromise()を呼び出して、リダイレクト後のパラメータを処理
                const loginResponse = await msalInstance.handleRedirectPromise();

                if (loginResponse) {
                    const acconutName = loginResponse.account.name
                    // 2. アクセストークンを使用して、ユーザー情報を取得するなどの処理を行う
                    setLoginUser(acconutName || "anonymous");
                    if (window.location.pathname === "/docsearch") {
                        // ログイン成功後に /docsearch へ戻る
                        navigate("/docsearch");
                    } else {
                        // トークン処理後にクエリパラメータを削除する
                        navigate("/", { replace: true });
                    }
                } else {
                    // トークンがない場合はログインを開始する
                    await msalInstance.loginRedirect({
                        scopes: [
                            "User.Read",
                        ]
                    });
                }
            } catch (error) {
                setLoginUser("anonymous");
            }
        };

        handleLogin();
    }, []);

    return loginUser;
};

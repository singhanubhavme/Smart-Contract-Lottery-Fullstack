import { useMoralis } from "react-moralis";
import { useEffect } from "react";

const ManualHeader = () => {
    const { 
        enableWeb3, 
        account, 
        isWeb3Enabled, 
        Moralis, 
        deactivateWeb3,
        isWeb3EnableLoading
    } = useMoralis();

    useEffect(() => {
        if (isWeb3Enabled) return;
        if (typeof window !== undefined) {
            if (window.localStorage.getItem("connected")) {
                enableWeb3();
            }
        }
    }, [enableWeb3, isWeb3Enabled]);

    useEffect(()=>{
        Moralis.onAccountChanged((account)=>{
            console.log("Account changed to ", account);
            if(!account){
                window.localStorage.removeItem("connected");
                deactivateWeb3();
                console.log("No Account Found");
            }
        })
    }, []); 

    return (
        <div>
            {account
                ?
                <div>
                    Connected to {account}
                </div>
                :
                <button onClick={
                    async () => {
                        await enableWeb3();
                        if (typeof window !== "undefined") {
                            window.localStorage.setItem("connected", "injected");
                        }
                    }
                }
                disabled={isWeb3EnableLoading}
                >
                    Connect
                </button>
            }
        </div>
    );
}

export default ManualHeader;
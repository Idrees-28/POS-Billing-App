import { Bell, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import "./Header.css";

function Header()
{
    const location =useLocation();
    const pageDetails = {
        "/":{
            title:"Dashboard",
            subtitle:"Welcome to POS Billing System",
        },
        "/customers":{
            title:"Customers",
            subtitle:"Manage your customer details",
        },
        "/products":{
            title:"Products",
            subtitle:"Manage your products and inventory",
        },
        "/pos":{
            title:"POS",
            subtitle:"Create and manage customer orders"
        },
        "/invoices":{
            title:"Invoices",
            subtitle:"View and manage your invoices",
        },
        "/settings":{
            title:"Settings",
            subtitle:"Manage your application settings",
        },
    };

    const currentPage = pageDetails[location.pathname];


    return(

        <header className="header">
            <div className="header-left">
                <h1>{currentPage.title}</h1>
                <p>{currentPage.subtitle}</p>
            </div>

            <div className="header-right"> 
                <button className="notification-btn">
                    <Bell size={20}/>
                </button>
             

            <div className="user-profile">
                <div className="user-icon">
                        <User size={20}/>
                </div>

                <div className="user-info">
                    <span className="user-name">Admin</span>
                    <span className="user-role">Administrator</span>
                </div>

            </div>

            </div>

        </header>
        
    );
}

export default Header;
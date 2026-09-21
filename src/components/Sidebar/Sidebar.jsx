import { NavLink } from "react-router-dom";
import { LayoutDashboard , Users , Package , ShoppingCart , FileText ,Settings } from "lucide-react";
import "./Sidebar.css";

function Sidebar()
{
    const menuItems = [
        {
            name:"Dashboard",
            path:"/",
            icon:LayoutDashboard,
        },
        {
            name:"Customers",
            path:"/customers",
            icon:Users,
        },
        {
            name:"Products",
            path:"/products",
            icon:Package,
        },
        {
            name:"POS",
            path:"/pos",
            icon:ShoppingCart,
        },
        {
            name:"Invoices",
            path:"/invoices",
            icon:FileText,
        },
        {
            name:"Settings",
            path:"/settings",
            icon:Settings,
        }
    ];
    return(
        <aside className="sidebar">
            <div className="logo">
                <h2>POS </h2>
                <span>Billing App</span>
            </div>

            <nav className="nav-menu">
                {menuItems.map((item)=>
                {
                    const Icon = item.icon;
                    return(
                        <NavLink
                        key={item.name}
                        to={item.path}
                        className={({isActive})=>
                        isActive? "nav-item active":"nav-item"
                        }
                        >
                            <Icon size={20}/>
                            <span>{item.name}</span>
                        </NavLink>
                    );
                })}
            </nav>
        </aside>
    );
}

export default Sidebar;
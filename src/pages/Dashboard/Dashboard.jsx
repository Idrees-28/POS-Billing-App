import { Users, Package, FileText , IndianRupee } from "lucide-react";

function Dashboard()
{
    const stats = [
        {
            title: "Total Customers" ,
            value: "0",
            icon: Users,
        },
        {
            title: "Total Products",
            value:"0",
            icon: Package,
        },
        {
            title: "Total Invoices",
            value: "0",
            icon: FileText,
        },
        {
            title: "Total Sales",
            value:"₹0",
            icon: IndianRupee,
        },
    ];
    return(
        <div className="dashboard">
            <div className="stats-grid">
                    {stats.map((stat)=>
                    {
                    const Icon = stat.icon;
                    return(
                        <div className="stat-card" key={stat.title}>
                            <div>
                                <p className="stat-title">{stat.title}</p>
                                <h2 className="stat-value"> {stat.value}</h2>
                            </div>

                            <div className="stat-icon"> 
                                <Icon size={24}/>
                            </div>

                        </div>
                    );
                }   
                    )}
            </div>

            <div className="dadhboard-section">
                <h2>
                    Recent Invoices
                </h2>
                <div className="empty-state">
                    <FileText size={40}/>

                    <p>No Invoices available Yet</p>

                </div>
            </div>
        </div>
    );
}

export default Dashboard;
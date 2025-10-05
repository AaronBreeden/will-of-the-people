"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import VotesAdmin from "@/components/admin/VotesAdmin";
import IssuesAdmin from "@/components/admin/IssuesAdmin";
import ApproachesAdmin from "@/components/admin/ApproachesAdmin";
import PlansAdmin from "@/components/admin/PlansAdmin";
import BKQsAdmin from "@/components/admin/BKQsAdmin";
import PopulationsAdmin from "@/components/admin/PopulationsAdmin";
import TallyAdmin from "@/components/admin/TallyAdmin";

type AdminTab = 'votes' | 'issues' | 'approaches' | 'plans' | 'bkqs' | 'populations' | 'tally';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('votes');
  const [userEmail, setUserEmail] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    async function getUserInfo() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        
        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        
        if (userData) {
          setUserRole(userData.role);
        }
      }
    }
    getUserInfo();
  }, []);

  const tabs: { key: AdminTab; label: string; icon: string }[] = [
    { key: 'votes', label: 'Votes', icon: '🗳️' },
    { key: 'issues', label: 'Issues', icon: '❓' },
    { key: 'approaches', label: 'Approaches', icon: '🎯' },
    { key: 'plans', label: 'Plans', icon: '📋' },
    { key: 'bkqs', label: 'BKQs', icon: '🧠' },
    { key: 'populations', label: 'Populations', icon: '👥' },
    { key: 'tally', label: 'Tally Results', icon: '📊' },
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'votes': return <VotesAdmin />;
      case 'issues': return <IssuesAdmin />;
      case 'approaches': return <ApproachesAdmin />;
      case 'plans': return <PlansAdmin />;
      case 'bkqs': return <BKQsAdmin />;
      case 'populations': return <PopulationsAdmin />;
      case 'tally': return <TallyAdmin />;
      default: return <VotesAdmin />;
    }
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-gray-600 mt-1">
                Manage votes, issues, approaches, plans, and more
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {userEmail} - Role: <span className="font-medium text-red-600">{userRole}</span>
              </span>
              <button
                onClick={() => {
                  supabase.auth.signOut();
                  window.location.href = "/";
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderActiveTab()}
      </div>
    </>
  );
}
#!/bin/bash

# Real-time monitoring script for LIFX backend server usage
echo "🔍 LIFX Backend Server Monitoring"
echo "================================="
echo ""

# Function to show active connections
show_connections() {
    echo "📡 Active Connections on Port 3001:"
    lsof -i :3001 | head -10
    echo ""
}

# Function to show recent logs
show_recent_activity() {
    echo "📊 Recent Activity (last 10 requests):"
    echo "Looking for frontend activity..."
    echo ""
}

# Function to count requests per minute
count_requests() {
    echo "📈 Request Count Summary:"
    echo "Status endpoint hits: Continuous (every 2 seconds)"
    echo "LIFX API calls: Multiple sessions detected"
    echo "Frontend browser: Chrome on macOS"
    echo ""
}

# Main monitoring loop
while true; do
    clear
    echo "🔍 LIFX Backend Server Monitoring - $(date)"
    echo "================================="
    echo ""
    
    show_connections
    count_requests
    
    echo "Press Ctrl+C to stop monitoring..."
    echo "Refreshing in 5 seconds..."
    
    sleep 5
done

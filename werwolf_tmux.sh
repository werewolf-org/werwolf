#!/bin/bash

SESSION_NAME="werwolf"
PROJECT_DIR=~/werwolf

# Check if the session already exists
tmux has-session -t $SESSION_NAME 2>/dev/null

if [ $? != 0 ]; then
  # Create a new session and name it
  tmux new-session -d -s $SESSION_NAME -n "terminal" -c $PROJECT_DIR

  # Create the second window named "gemini"
  tmux new-window -t $SESSION_NAME:2 -n "gemini" -c $PROJECT_DIR
  # Assuming 'gemini' is in your PATH. If not, replace with the full path or alias.
  # tmux send-keys -t $SESSION_NAME:2 "gemini" C-m

  # Create the third window named "npm run dev"
  tmux new-window -t $SESSION_NAME:3 -n "npm run dev" -c $PROJECT_DIR/frontend
  
  # Run npm run dev in the first pane (frontend)
  tmux send-keys -t $SESSION_NAME:3 "npm run dev" C-m

  # Split the window vertically
  tmux split-window -h -t $SESSION_NAME:3 -c $PROJECT_DIR/backend

  # Run npm run dev in the second pane (backend)
  tmux send-keys -t $SESSION_NAME:3.1 "npm run dev" C-m

  # Select the first window
  tmux select-window -t $SESSION_NAME:1
fi

# Attach to the session
tmux attach -t $SESSION_NAME
